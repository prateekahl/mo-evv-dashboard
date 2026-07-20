// ---------------------------------------------------------------------------
// MO EVV Accruals + Aggregator — dashboard config
//
// Fill these in once the Jira project and filters exist. Nothing else in
// app.js needs to change — it only reads from window.DASHBOARD_CONFIG.
// ---------------------------------------------------------------------------
window.DASHBOARD_CONFIG = {

  // Human-readable target date shown in the header + used for "days to target"
  // Format: "YYYY-MM-DD"
  targetDate: "2026-08-12", // e.g. "2026-09-30"

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
  },

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
