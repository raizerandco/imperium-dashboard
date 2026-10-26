# Imperium Dashboard Publisher

Replaces the old n8n "Dashboard Publisher" workflow. One place to change everything.

## What it does
`build.js` reads Supabase (rentals, cars, partners), injects the data into
`template.html`, and writes two builds:
- `out/growth/index.html`  -> published to raizerandco/imperium-ceo
- `out/operational/index.html` -> published to raizerandco/imperium-ops

A GitHub Action (`.github/workflows/publish.yml`) runs it on a schedule and
pushes each index.html to its repo. Cloudflare Pages auto-deploys on commit.

## Change things by talking to Claude Code
- The dashboard look/layout -> edit `template.html`
- Monthly goal, repo targets, fallbacks -> edit `config.js`
- The data mapping -> edit `build.js`

## Secrets (set in this repo: Settings > Secrets and variables > Actions)
- SUPABASE_URL
- SUPABASE_SERVICE_KEY   (service_role)
- GH_PAT                 (fine-grained PAT, Contents: write on imperium-ceo + imperium-ops)

## Run locally
    SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node build.js
Outputs go to ./out/ .

## Schedule
Edit the cron in `.github/workflows/publish.yml` (default: every 20 min).
Run on demand from the repo's Actions tab -> "Publish Imperium Dashboards" -> Run workflow.
