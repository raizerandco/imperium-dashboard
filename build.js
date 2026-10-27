// Imperium Dashboard Publisher — ported 1:1 from the old n8n "Code" node.
// Reads Supabase (rentals, cars, partners), injects data into template.html,
// and writes two builds to ./out/growth/index.html and ./out/operational/index.html.
// The GitHub Action then pushes each to its target repo.
//
// Env required: SUPABASE_URL, SUPABASE_SERVICE_KEY
// No npm dependencies — uses Node 18+ global fetch.

const fs = require("fs");
const path = require("path");
const CFG = require("./config.js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars.");
  process.exit(1);
}

// --- read every row of a table (PostgREST caps pages at 1000, so paginate) ---
async function fetchAll(table) {
  const pageSize = 1000;
  let offset = 0, out = [];
  for (;;) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&order=id.asc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!res.ok) throw new Error(`Supabase ${table} ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    out = out.concat(rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

(async () => {
  const [rentals, cars, partners] = await Promise.all([
    fetchAll(CFG.TABLES.rentals),
    fetchAll(CFG.TABLES.cars),
    fetchAll(CFG.TABLES.partners),
  ]);
  const html = fs.readFileSync(path.join(__dirname, CFG.TEMPLATE_FILE), "utf8");

  const fleet = cars.map((c) => ({
    plate: c.plate, make: c.make, model: c.model,
    hex: c.hex || CFG.FLEET_FALLBACK_HEX, price: c.price, deposit: c.deposit,
  }));

  const R = rentals.map((r) => ({
    ag: r.agreement_no, cust: r.client_name, plate: r.plate,
    start: r.start_at, end: r.end_at,
    total: r.total, net: r.net, fees: r.fees,
    ref: r.ref, country: r.country,
    delivery: r.delivery_address, pickup: r.pickup_address,
    phone: r.client_phone, email: r.client_email,
    deposit: r.deposit, price: r.daily_rate,
    broker: r.broker_name, broker_email: r.broker_email,
    broker_commission: r.broker_commission, broker_rate: r.broker_rate,
    broker_address: r.broker_address, broker_ein: r.broker_ein,
    notes: r.notes, payment: r.payment_type,
    signed_pdf_url: r.signed_pdf_url ?? null,
    id: r.id, delivery_time: r.delivery_time ?? null, pickup_time: r.pickup_time ?? null,
    paid: r.paid ?? false,
  }));

  const sheetTotal = R.reduce((s, r) => s + (Number(r.total) || 0), 0);

  const b2b = (() => {
    const total = partners.length;
    const byCountry = {}, byStatus = {}, byType = {};
    let contacted = 0, replied = 0, pending = 0, signed = 0, interested = 0, totalTouches = 0, noEmail = 0;
    let us = 0, intl = 0;
    for (const p of partners) {
      const c = p.country || "—";
      byCountry[c] = (byCountry[c] || 0) + 1;
      byStatus[p.status || "—"] = (byStatus[p.status || "—"] || 0) + 1;
      byType[p.type || "—"] = (byType[p.type || "—"] || 0) + 1;
      totalTouches += Number(p.touch_count) || 0;
      if (p.replied_at) replied++;
      if (p.status === "signed") signed++;
      if (p.status === "interested") interested++;
      if ((Number(p.touch_count) || 0) > 0) contacted++; else pending++;
      if (!p.email) noEmail++;
      if (c === "United States") us++; else intl++;
    }
    const list = partners.map((p) => ({
      company: p.company, email: p.email, phone: p.phone,
      country: p.country, type: p.type, status: p.status,
      touches: Number(p.touch_count) || 0, replied: !!p.replied_at,
    }));
    return { total, us, intl, contacted, pending, replied, signed, interested,
             totalTouches, noEmail, byCountry, byStatus, byType, list };
  })();

  // ---- monthly revenue goal (growth only) ----
  const GOAL = CFG.GOAL;
  const goal = (() => {
    const byMonth = {};
    for (const r of R) {
      if (!r.start || r.total == null) continue;
      const key = String(r.start).slice(0, 7); // 'YYYY-MM'
      byMonth[key] = (byMonth[key] || 0) + Number(r.total);
    }
    const keys = Object.keys(byMonth).sort();
    const mLabel = (k) => { const [y, m] = k.split("-");
      return new Date(+y, +m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" }); };
    const nowKey = new Date().toISOString().slice(0, 7);
    const curTotal = byMonth[nowKey] || 0;
    const idx = keys.indexOf(nowKey);
    const prevKey = idx > 0
      ? keys[idx - 1]
      : (keys.length && keys[keys.length - 1] !== nowKey ? keys[keys.length - 1] : null);
    const prevTotal = prevKey ? byMonth[prevKey] : 0;
    return {
      target: GOAL,
      currentLabel: mLabel(nowKey),
      currentTotal: Math.round(curTotal),
      pct: Math.min(100, Math.round((curTotal / GOAL) * 100)),
      remaining: Math.max(0, Math.round(GOAL - curTotal)),
      growthPct: (prevTotal && curTotal) ? Math.round(((curTotal - prevTotal) / prevTotal) * 100) : null,
      months: keys.map((k) => ({ key: k, total: Math.round(byMonth[k]) })),
    };
  })();

  function build(mode) {
    let p;
    if (mode === "operational") {
      p = {
        fleet,
        rentals: R.map((r) => ({
          ag: r.ag, cust: r.cust, plate: r.plate, start: r.start, end: r.end,
          delivery: r.delivery, pickup: r.pickup, phone: r.phone, email: r.email,
          deposit: r.deposit, price: r.price, notes: r.notes,
          signed_pdf_url: r.signed_pdf_url,
          id: r.id, delivery_time: r.delivery_time, pickup_time: r.pickup_time, paid: r.paid,
          total: r.total,
          net: null, fees: null,
          broker: null, broker_commission: null, broker_rate: null, payment: null,
        })),
        unmatched: [], sheet: null, orphans: {},
        prospecting: { weeks: [] },
        generated: new Date().toISOString().slice(0, 10),
      };
    } else {
      p = {
        fleet, rentals: R, unmatched: [],
        sheet: { total: sheetTotal, net: 0, fees: 0 },
        orphans: {},
        prospecting: { weeks: [], email: { campaigns: [] }, gabby: {} },
        b2b: b2b,
        goal: goal,
        generated: new Date().toISOString().slice(0, 10),
      };
    }
    const build_date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    // CEO (growth) dashboard is password-gated; OPS (operational / TV) stays open.
    // Hash is djb2 of the access password "Imp-rental-Qv83kP2z" (same as the docs function).
    const gate = mode === "growth" ? "1045169636" : "0";
    return String(html)
      .split("__DATA__").join(JSON.stringify(p))
      .split("__MODE__").join(mode)
      .split("__BUILD__").join(build_date)
      .split("__GATE__").join(gate);
  }

  const outDir = path.join(__dirname, "out");
  fs.mkdirSync(path.join(outDir, "growth"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "operational"), { recursive: true });
  fs.writeFileSync(path.join(outDir, "growth", "index.html"), build("growth"));
  fs.writeFileSync(path.join(outDir, "operational", "index.html"), build("operational"));

  console.log(`Built: ${R.length} rentals, ${fleet.length} cars, ${partners.length} partners.`);
})().catch((e) => { console.error(e); process.exit(1); });
