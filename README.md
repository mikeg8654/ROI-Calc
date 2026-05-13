# MD Ally ROI Calculator

Single-page ROI tool used by MD Ally Public Safety Partnerships for live prospect modeling.

**Live**: https://roi-calc-production.up.railway.app/

## Usage

## Refresh offline ZIP density data

```bash
py scripts/build_zip_density.py
```

Produces `assets/zip-density.json` (~400KB) from SimpleMaps US-Zips (MIT). Used as offline fallback when Census TIGERweb is unreachable.

## URL params

URL params auto-populate inputs:

- `name` — agency name
- `zip` — 5-digit ZIP code
- `pop` — population served
- `area` — `rural` | `suburban` | `urban`
- `calls` — annual medical 911 calls (optional; overrides pop-based eligibility)
- `discount` — partner rate adjustment, 0–20
- `depth` — `parallel` | `uni` | `bi`
- `mods` — comma list, e.g. `path,apm,vamc`

Example: `?name=Nicks+Fire+Department&pop=414132&area=suburban&depth=bi&mods=path,apm,vamc`

## Deploy

Railway runs `npm start` which serves the static site via [`serve`](https://www.npmjs.com/package/serve) on `$PORT`. No build step. Auto-deploys on push to `main`.

## Pulse integration (Brief Me on This Agency)

The calc is a thin client to the Pulse `/api/agency-brief` endpoint (see Pulse repo). It runs in three modes:

1. **Stub mode (default)** — no Pulse base configured. Brief Me returns a stub; NPI typeahead + math are fully live. Safe production fallback.
2. **URL-param mode** — append `?pulse_base=https://pulse.mdally.com&pulse_key=<shared-secret>` to test Pulse integration without redeploying the calc.
3. **Hardcoded mode** — once Pulse is GA, edit `index.html` (one line near `const PULSE_API_BASE`) to set the production base + key. Push to `main` and Railway redeploys.

CORS allow-list on the Pulse side must include `roi-calc-production.up.railway.app`.

## Versioning

Current version is rendered in the footer (`#ver`). Bump it in `index.html` and `package.json` together. Add a changelog entry in the in-app changelog list.

## Enhancement loop

In-app "Suggest" form captures requests to `localStorage` (and an optional webhook). Mike exports the queue as JSON and runs the autobuild script against it. Candidates land in a staging folder for review before shipping over `index.html`.
