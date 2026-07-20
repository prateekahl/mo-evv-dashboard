# MO EVV Accruals + Aggregator — Release Burndown

A read-through-to-live-data dashboard modeled on the "Viv view" of the
Compliance V2 burndown board, pointed at the Bayada MO EVV Accruals +
Aggregator workstream. Runs as static HTML/CSS/JS with two Netlify
serverless functions acting as a Jira proxy so no API token ever reaches
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

## 2. Set up Jira (whenever your filters are ready)

1. Create/confirm the Jira project for MO EVV Accruals + Aggregator, and note its **project key** (e.g. `MOEVV`).
2. Create three saved filters (or just JQL strings — filters aren't required, they just give you the "Open in Jira ↗" links):
   - **Combined**: everything still to certify, e.g.
     `project = MOEVV AND statusCategory != Done ORDER BY updated DESC`
   - **Certified**: done on the target release line, e.g.
     `project = MOEVV AND fixVersion = "4.6.0" AND status = Done`
   - **QA**: `project = MOEVV AND status in ("QA In Progress", "Ready for QA", ...)`
   - **DEV**: `project = MOEVV AND status in ("In Development", "Code Review", ...)`
3. Grab each filter's ID from its URL (`.../issues/?filter=18679` → `18679`).
4. Create a Jira API token: Atlassian account → **Security** → **API tokens** → **Create API token**.
5. If you want ticket creation to auto-assign DEV/QA people, grab their **account IDs** (visible in their Jira profile URL, or via `Atlassian:lookupJiraAccountId` if you're doing this through Claude/Atlassian MCP).

## 3. Fill in `config.js`

Open `config.js` and set:

```js
targetDate: "2026-09-30",
jiraBaseUrl: "https://vivtechnologies.atlassian.net",
jql: {
  combined: "project = MOEVV AND statusCategory != Done",
  certified: "project = MOEVV AND fixVersion = \"4.6.0\" AND status = Done",
  qa: "project = MOEVV AND status in (\"QA In Progress\")",
  dev: "project = MOEVV AND status in (\"In Development\")",
},
filterIds: { qa: "", dev: "", certified: "" },
ticketDefaults: { projectKey: "MOEVV" },
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
| `JIRA_PROJECT_KEY` | e.g. `MOEVV` |
| `JIRA_DEV_ASSIGNEE_ACCOUNT_ID` | optional, for ticket auto-assignment |
| `JIRA_QA_ASSIGNEE_ACCOUNT_ID` | optional, for ticket auto-assignment |

Redeploy (Netlify → Deploys → Trigger deploy) after adding these so the functions pick them up.

## 6. Verify

- Load the site — stat cards, donuts, and tables should populate from Jira within a couple seconds.
- Click **Open Ticket**, submit a test issue, confirm it lands in the Jira project.
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
app.js                            fetch/render logic, modals
netlify/functions/jira-search.js  JQL search proxy (GET)
netlify/functions/jira-create.js  ticket creation proxy (POST)
netlify.toml                      Netlify build/publish config
```
