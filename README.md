# MO EVV Accruals + Aggregator — Release Burndown

A read-only, live-data dashboard modeled on the "Viv view" of the
Compliance V2 burndown board, pointed at the Bayada MO EVV Accruals +
Aggregator workstream. Runs as static HTML/CSS/JS with a Netlify
serverless function acting as a Jira proxy so no API token ever reaches
the browser.

The dashboard renders fine right now with empty state ("—" everywhere) —
it just has no Jira filters wired up yet. Everything below gets it live.

## 1. Push this to GitHub

```bash
cd mo-evv-dashboard
git add -A
git commit -m "Initial MO EVV Accruals + Aggregator dashboard"
gh repo create mo-evv-dashboard --private --source=. --push
# or, without the GitHub CLI:
# git remote add origin https://github.com/<your-org>/mo-evv-dashboard.git
# git push -u origin main
```

## 2. Set up Jira

The QA, DEV, and Certified JQL are already wired into `config.js`, scoped to the `"Projects[Checkboxes]"` field for **MO EVV Aggregators** and **MO EVV Accruals**. Still to do:

1. Set `targetDate` in `config.js` (format `"YYYY-MM-DD"`) once you have a release target.
2. Create a Jira API token: Atlassian account → **Security** → **API tokens** → **Create API token**.

## 3. Set the target date

Open `config.js` and set:

```js
targetDate: "2026-09-30",
```

Commit and push — Netlify redeploys automatically on every push once step 4 is done.

## 4. Connect the repo to Netlify

Since you already have a Netlify account:

1. Netlify dashboard → **Add new site** → **Import an existing project**.
2. Choose GitHub, authorize if prompted, select the `mo-evv-dashboard` repo.
3. Build settings: leave **build command** blank, **publish directory** `.` — `netlify.toml` already has this, so Netlify should auto-detect it.
4. Click **Deploy site**. You'll get a random `*.netlify.app` URL you can rename in Site settings → Domain management.

## 5. Add environment variables

In Netlify: **Site settings → Environment variables**, add:

| Key | Value |
|---|---|
| `JIRA_BASE_URL` | `https://vivtechnologies.atlassian.net` |
| `JIRA_EMAIL` | the email tied to the API token |
| `JIRA_API_TOKEN` | the token from step 2.4 |

Redeploy (Netlify → Deploys → Trigger deploy) after adding these so the function picks them up.

## 6. Verify

- Load the site — stat cards, donuts, and tables should populate from Jira within a couple seconds.
- Click **↺ Refresh** to confirm live polling works; it also auto-refreshes every 5 minutes (`refreshIntervalMs` in `config.js`).

## Notes on the burn-rate calc

There's no historical database here, so "certified/day" is approximated
client-side: the dashboard stamps a "first seen" date in the visitor's
browser (`localStorage`) the first time they load it, and divides current
certified count by business days elapsed since then. It's a reasonable
placeholder but resets per-browser and isn't a shared team-wide metric —
if you want a real historical burn rate, that needs a small datastore
(e.g. a Netlify Blob or a scheduled function that snapshots counts daily)
rather than something a static site can do alone. Happy to build that
next if useful.

## File map

```
index.html                        markup
style.css                         design tokens + layout
config.js                         Jira filters/JQL — the only file you edit routinely
app.js                            fetch/render logic
netlify/functions/jira-search.js  JQL search proxy (GET)
netlify.toml                      Netlify build/publish config
```
