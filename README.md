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

- Load the site — stat cards, status lists, and tables should populate from Jira within a couple seconds.
- Click **↺ Refresh** to confirm live polling works; it also auto-refreshes every 5 minutes (`refreshIntervalMs` in `config.js`).

## Notes on pagination

Jira's search API caps each response at 100 issues per page. The
`jira-search` function loops through every page (using Jira's
`nextPageToken`) and returns the full combined list, so panels with more
than 100 matching tickets (e.g. a large certified backlog) show the true
count rather than silently truncating at 100. There's a safety cap of 20
pages (2,000 issues) per panel — raise `MAX_PAGES` in
`netlify/functions/jira-search.js` if you ever need more than that.

## Notes on the burn-rate calc

**Formula:** `(tickets certified in the trailing 14 calendar days) ÷ (working days in that window)`

This now comes straight from Jira's own transition history, not a client-side
guess. `config.js` has a `jql.recentlyCertified` query:

```
statusCategory = Done and statuscategorychangedate >= -14d
```

`statuscategorychangedate` is a real Jira field that records when an issue's
status *category* last changed — so this counts tickets that actually became
Done in the last 14 calendar days, straight from Jira's audit trail. The
denominator is the number of Mon–Fri working days inside that same trailing
14-day window (typically 10, occasionally more/less depending on how the
window lands on weekends) — computed client-side in `app.js`.

This is shared and accurate for everyone who loads the dashboard — no
per-browser state, no "wait 14 days for it to warm up" like the previous
version. One caveat: Jira's relative-date literals like `-14d` are evaluated
in your Jira instance's configured time zone, not necessarily UTC — worth
knowing if you ever see the count shift by a ticket right at a day boundary.

## Notes on the target date

`targetDate` in `config.js` is parsed as **UTC midnight** (the `Z` suffix on
`T00:00:00Z` in `app.js` is what does this), so "Aug 5" means the same
instant for every visitor regardless of their local timezone — not the
visitor's own local midnight on Aug 5.

`config.js`, `app.js`, and `index.html` are also set to `Cache-Control:
no-cache, no-store, must-revalidate` in `netlify.toml`, and the script tags
in `index.html` carry a `?v=` cache-busting query param. Both exist to stop
browsers/CDNs from serving a stale target date after a deploy. **If you
change `config.js` or `app.js` again, bump the `?v=` value in `index.html`'s
script tags too** — that's the belt-and-suspenders half of the fix; the
no-cache headers alone should already be sufficient, but the version bump
guarantees it.

## Notes on the crucial-epics highlighting and the top 4 stat cards

`config.js` has a `crucialEpics` array (and a matching `CRUCIAL_EPICS_CLAUSE`
JQL literal above the config object) — currently the 4 epics whose child
work items are crucial for the 4.5.0-bayada UAT drop.

**Row highlighting**: any ticket rendered in the certified/QA/DEV tables
whose Jira `parent` is in `crucialEpics` gets a yellow left-border highlight
(`.crucial-row` in `style.css`).

**The top 4 stat cards use two different scopes on purpose** — this tripped
us up once already, worth being explicit about:

- **Combined MO EVV tickets** and **Certified MO EVV tickets** (and, by
  extension, **Total tickets actioned**) use the *union* of two conditions:
  tagged `Projects[Checkboxes]` = MO EVV Aggregators/Accruals, **or** a
  child of one of the 4 crucial epics. A ticket only needs to match one of
  the two to count — it doesn't need both. This means these three cards can
  include tickets that were never tagged MO EVV at all, as long as they
  belong to one of the crucial epics.
- **Certified Crucial MO EVV tickets** uses *only* epic membership
  (`crucialCertified` JQL) — the MO EVV tag is irrelevant here, so this
  number is **not** a subset of "Certified MO EVV tickets" above it, even
  though it sits right next to it. It's a completely separate count: all
  Done children of the 4 epics, regardless of tag.

Concretely, as of this writing: 176 tickets carry the MO EVV tag and are
Done; 502 are Done children of the 4 epics; only 160 satisfy both. So
"Certified MO EVV tickets" (union, tag OR epics) = 518, while "Certified
Crucial MO EVV tickets" (epics only) = 502 — two different, overlapping-but-
not-nested numbers. If that ever looks wrong, it's worth re-confirming
which of the two scopes you actually want for each card rather than
assuming one word.

This is JQL-driven (`parent in (...)` / `Projects[Checkboxes] in (...)`)
rather than a hardcoded ticket list, so it stays correct as tickets move
between statuses — no manual updates needed unless the set of crucial
epics itself changes, in which case edit `crucialEpics` **and**
`CRUCIAL_EPICS_CLAUSE` together (they're two separate literals that need
to stay in sync).


## File map

```
index.html                        markup

style.css                         design tokens + layout
config.js                         Jira filters/JQL — the only file you edit routinely
app.js                            fetch/render logic
netlify/functions/jira-search.js  JQL search proxy (GET)
netlify.toml                      Netlify build/publish config
```
