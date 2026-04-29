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
- `pop` — population served
- `area` — `suburban` | `urban` | `rural`
- `calls` — annual 911 call volume (optional; auto-computes from pop)
- `transports` — annual transports (optional)
- `depth` — `bi` (billable-only) or other tier
- `mods` — comma list, e.g. `path,apm,vamc`

Example: `?name=Nicks+Fire+Department&pop=414132&area=suburban&depth=bi&mods=path,apm,vamc`

## Deploy

Railway runs `npm start` which serves the static site via [`serve`](https://www.npmjs.com/package/serve) on `$PORT`. No build step.

## Versioning

Current version is rendered in the footer (`#ver`). Bump it in `index.html` and `package.json` together. Add a changelog entry in the in-app changelog list.

## Enhancement loop

In-app "Suggest" form captures requests to `localStorage` (and an optional webhook). Mike exports the queue as JSON and runs the autobuild script against it. Candidates land in a staging folder for review before shipping over `index.html`.
