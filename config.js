// ---------------------------------------------------------------------------
// MO EVV Accruals + Aggregator — dashboard config
//
// Fill these in once the Jira project and filters exist. Nothing else in
// app.js needs to change — it only reads from window.DASHBOARD_CONFIG.
// ---------------------------------------------------------------------------

// Shared building blocks for the JQL below — defined once so the two
// conditions stay in sync everywhere they're combined.
const MO_EVV_TAG = `"Projects[Checkboxes]" in ("MO EVV Aggregators", "MO EVV Accruals")`;
const CRUCIAL_EPICS_CLAUSE = `parent in (DEV-47574, DEV-37860, DEV-43129, DEV-43319)`;
// Union: ticket counts as "in scope" if it matches EITHER the MO EVV tag
// OR is a child of one of the 4 crucial epics (not both required).
const MO_EVV_OR_CRUCIAL = `(${MO_EVV_TAG} or ${CRUCIAL_EPICS_CLAUSE})`;

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
    // Outstanding tickets from EITHER the MO EVV tag OR the 4 crucial epics
    // (union, not intersection) — To Do / In Progress status category.
    combined: `${MO_EVV_OR_CRUCIAL} and statusCategory in ("To Do", "In Progress") ORDER BY created DESC`,

    // Done tickets from EITHER the MO EVV tag OR the 4 crucial epics (union).
    certified: `${MO_EVV_OR_CRUCIAL} and statusCategory in (Done) ORDER BY created DESC`,

    // QA pipeline tickets (drives the "QA by status" list + live QA table)
    qa: `${MO_EVV_TAG} and status IN ("Ready For Testing", "In Testing", "Re-verify Bug", "Testing in Branch") ORDER BY created DESC`,

    // DEV pipeline tickets (drives the "DEV by status" list + live DEV table)
    dev: `${MO_EVV_TAG} and status NOT IN ("In Testing", "Ready For Testing", "Testing in Branch", "Resolved Without Code", "QA Certified", "Re-verify Bug", "NO QA - Certified", "Retest After Cherrypick", "Archived") ORDER BY created DESC`,

    // Drives the burn-rate stat: tickets whose status category became Done
    // in the trailing 14 calendar days. Uses Jira's own statuscategorychangedate
    // field, so this reflects real transition history, not a client-side guess.
    recentlyCertified: `${MO_EVV_TAG} and statusCategory = Done and statuscategorychangedate >= -14d ORDER BY statuscategorychangedate DESC`,

    // Child work items of the 4 crucial-for-UAT epics ONLY (no union with the
    // MO EVV tag) that have reached a Done status category. Drives the
    // "Certified Crucial MO EVV Tickets" stat card.
    crucialCertified: `${CRUCIAL_EPICS_CLAUSE} and statusCategory = Done ORDER BY key ASC`,

    // Child work items of the crucial epics ONLY, still in To Do or In
    // Progress. Drives the yellow bracketed count on "Combined MO EVV Tickets".
    crucialOutstanding: `${CRUCIAL_EPICS_CLAUSE} and statusCategory in ("To Do", "In Progress") ORDER BY key ASC`,
  },

  // Epics whose child work items are crucial for a UAT drop. Any ticket
  // rendered elsewhere on the dashboard (QA/DEV/certified tables) whose
  // `parent` is one of these gets a yellow row highlight. Update this list
  // whenever the crucial-epic set changes — nothing else needs to change,
  // since the jql entries above and the row-highlight logic in app.js all
  // read from here (well — the CRUCIAL_EPICS_CLAUSE above is a separate
  // literal; keep both in sync if the epic set ever changes).
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
