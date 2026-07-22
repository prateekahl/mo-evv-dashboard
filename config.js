// ---------------------------------------------------------------------------
// MO EVV Accruals + Aggregator — dashboard config
//
// Fill these in once the Jira project and filters exist. Nothing else in
// app.js needs to change — it only reads from window.DASHBOARD_CONFIG.
// ---------------------------------------------------------------------------
window.DASHBOARD_CONFIG = {

  // Human-readable target date shown in the header + used for "days to target".
  // Format: "YYYY-MM-DD". Interpreted as UTC midnight (see app.js) — not the
  // visitor's local midnight — so this date means the same instant for
  // everyone regardless of timezone.
  targetDate: "2026-08-05",

  // Jira base URL, e.g. "https://vivtechnologies.atlassian.net"
  jiraBaseUrl: "https://vivtechnologies.atlassian.net",

  // JQL used to populate each panel. These are queried through the Netlify
  // function proxy (see netlify/functions/jira-search.js), never directly
  // from the browser.
  jql: {
    // All MO EVV Accruals + Aggregator tickets still to certify (DEV + QA).
    // Assumption: "not yet certified" = not in a Done status category —
    // adjust if that doesn't match what you want counted here.
    combined: `"Projects[Checkboxes]" in ("MO EVV Aggregators", "MO EVV Accruals") and statusCategory != Done ORDER BY created DESC`,

    // Tickets that have reached a Done status
    certified: `"Projects[Checkboxes]" in ("MO EVV Aggregators", "MO EVV Accruals") and statusCategory in (Done) ORDER BY created DESC`,

    // QA pipeline tickets (drives the "QA by status" list + live QA table)
    qa: `"Projects[Checkboxes]" in ("MO EVV Aggregators", "MO EVV Accruals") and status IN ("Ready For Testing", "In Testing", "Re-verify Bug", "Testing in Branch") ORDER BY created DESC`,

    // DEV pipeline tickets (drives the "DEV by status" list + live DEV table)
    dev: `"Projects[Checkboxes]" in ("MO EVV Aggregators", "MO EVV Accruals") and status NOT IN ("In Testing", "Ready For Testing", "Testing in Branch", "Resolved Without Code", "QA Certified", "Re-verify Bug", "NO QA - Certified", "Retest After Cherrypick", "Archived") ORDER BY created DESC`,

    // Drives the burn-rate stat: tickets whose status category became Done
    // in the trailing 14 calendar days. Uses Jira's own statuscategorychangedate
    // field, so this reflects real transition history, not a client-side guess.
    recentlyCertified: `"Projects[Checkboxes]" in ("MO EVV Aggregators", "MO EVV Accruals") and statusCategory = Done and statuscategorychangedate >= -14d ORDER BY statuscategorychangedate DESC`,

    // Child work items of the 4 crucial-for-UAT epics (see crucialEpics below)
    // that have reached a Done status category. Drives the "Certified Crucial
    // MO EVV Tickets" stat card.
    crucialCertified: `parent in (DEV-47574, DEV-37860, DEV-43129, DEV-43319) and statusCategory = Done ORDER BY key ASC`,

    // Child work items of the crucial epics still in To Do or In Progress.
    // Drives the yellow bracketed count on the "Combined MO EVV Tickets" card.
    crucialOutstanding: `parent in (DEV-47574, DEV-37860, DEV-43129, DEV-43319) and statusCategory in ("To Do", "In Progress") ORDER BY key ASC`,
  },

  // Epics whose child work items are crucial for a UAT drop. Any ticket
  // rendered elsewhere on the dashboard (QA/DEV/certified tables) whose
  // `parent` is one of these gets a yellow row highlight. Update this list
  // whenever the crucial-epic set changes — nothing else needs to change,
  // since the two jql entries above and the row-highlight logic in app.js
  // both read from here.
  crucialEpics: ["DEV-47574", "DEV-37860", "DEV-43129", "DEV-43319"],

  // Optional: force a specific status's badge/pill color instead of the
  // default heuristic (green = "in testing"/"in progress", red = "needs"/
  // "fail"/"reject", blue = "ready", everything else neutral gray). Keys
  // must match the Jira status name exactly.
  // Values: "blue", "green", "amber", "red", "purple", or "" for neutral.
  // Example:
  // statusColors: {
  //   "Blocked": "red",
  //   "Needs Requirements": "amber",
  //   "In Testing": "green",
  // },
  statusColors: {},

  // Poll interval for auto-refresh, in ms. Set to 0 to disable auto-refresh.
  refreshIntervalMs: 5 * 60 * 1000,
};
