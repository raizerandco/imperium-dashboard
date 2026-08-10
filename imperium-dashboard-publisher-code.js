const rentals  = $('rentals').all().map(i => i.json);
const cars     = $('cars').all().map(i => i.json);
const partners = $('partners').all().map(i => i.json);
const html     = $('template').first().json.data ?? $('template').first().json.body;
const fleet = cars.map(c => ({
  plate: c.plate, make: c.make, model: c.model,
  hex: c.hex || '#888888', price: c.price, deposit: c.deposit
}));
const R = rentals.map(r => ({
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
  notes: r.notes, payment: r.payment_type
}));
const sheetTotal = R.reduce((s, r) => s + (Number(r.total) || 0), 0);
const b2b = (() => {
  const total = partners.length;
  const byCountry = {}, byStatus = {}, byType = {};
  let contacted = 0, replied = 0, pending = 0, signed = 0, interested = 0, totalTouches = 0, noEmail = 0;
  let us = 0, intl = 0;
  for (const p of partners) {
    const c = p.country || '—';
    byCountry[c] = (byCountry[c] || 0) + 1;
    byStatus[p.status || '—'] = (byStatus[p.status || '—'] || 0) + 1;
    byType[p.type || '—'] = (byType[p.type || '—'] || 0) + 1;
    totalTouches += Number(p.touch_count) || 0;
    if (p.replied_at) replied++;
    if (p.status === 'signed') signed++;
    if (p.status === 'interested') interested++;
    if ((Number(p.touch_count) || 0) > 0) contacted++; else pending++;
    if (!p.email) noEmail++;
    if (c === 'United States') us++; else intl++;
  }
  const list = partners.map(p => ({
    company: p.company, email: p.email, phone: p.phone,
    country: p.country, type: p.type, status: p.status,
    touches: Number(p.touch_count) || 0, replied: !!p.replied_at
  }));
  return { total, us, intl, contacted, pending, replied, signed, interested,
           totalTouches, noEmail, byCountry, byStatus, byType, list };
})();

// ---- monthly revenue goal (growth only) ----
const GOAL = 335000;
const goal = (() => {
  const byMonth = {};
  for (const r of R) {
    if (!r.start || r.total == null) continue;
    const key = String(r.start).slice(0, 7);          // 'YYYY-MM'
    byMonth[key] = (byMonth[key] || 0) + Number(r.total);
  }
  const keys = Object.keys(byMonth).sort();
  const mLabel = k => { const [y, m] = k.split('-');
    return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); };
  const nowKey = new Date().toISOString().slice(0, 7); // current calendar month
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
    pct: Math.min(100, Math.round(curTotal / GOAL * 100)),
    remaining: Math.max(0, Math.round(GOAL - curTotal)),
    growthPct: (prevTotal && curTotal) ? Math.round((curTotal - prevTotal) / prevTotal * 100) : null,
    months: keys.map(k => ({ key: k, total: Math.round(byMonth[k]) }))
  };
})();

function build(mode) {
  let p;
  if (mode === 'operational') {
    p = {
      fleet,
      rentals: R.map(r => ({
        ag: r.ag, cust: r.cust, plate: r.plate, start: r.start, end: r.end,
        delivery: r.delivery, pickup: r.pickup, phone: r.phone, email: r.email,
        deposit: r.deposit, price: r.price, notes: r.notes,
        total: null, net: null, fees: null,
        broker: null, broker_commission: null, broker_rate: null, payment: null
      })),
      unmatched: [], sheet: null, orphans: {},
      prospecting: { weeks: [] },
      generated: new Date().toISOString().slice(0,10)
    };
  } else {
    p = {
      fleet, rentals: R, unmatched: [],
      sheet: { total: sheetTotal, net: 0, fees: 0 },
      orphans: {},
      prospecting: { weeks: [], email: { campaigns: [] }, gabby: {} },
      b2b: b2b,
      goal: goal,
      generated: new Date().toISOString().slice(0,10)
    };
  }
  const build_date = new Date().toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'});
  return String(html)
    .split('__DATA__').join(JSON.stringify(p))
    .split('__MODE__').join(mode)
    .split('__BUILD__').join(build_date)
    .split('__GATE__').join('0');
}
return [{ json: {
  growth_html: build('growth'),
  operational_html: build('operational'),
  count_rentals: R.length,
  count_cars: fleet.length,
  count_partners: partners.length
}}];
