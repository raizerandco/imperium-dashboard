// Edit the things you change often here. Claude Code can update this for you.
module.exports = {
  // Monthly revenue goal shown on the growth (CEO) dashboard Financials tab.
  GOAL: 335000,

  // Default fallback color for a car with no hex set.
  FLEET_FALLBACK_HEX: "#888888",

  // Template file in this repo (reused by both the n8n flow and this publisher).
  TEMPLATE_FILE: "dashboard_template_updated.html",

  // Supabase tables to read.
  TABLES: { rentals: "rentals", cars: "cars", partners: "partners" },

  // Where each build is published (owner/repo on GitHub). The Action pushes index.html here.
  TARGETS: {
    growth:      { repo: "raizerandco/imperium-ceo",  file: "index.html" },
    operational: { repo: "raizerandco/imperium-ops",  file: "index.html" },
  },
};
