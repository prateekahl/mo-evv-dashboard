// ---------------------------------------------------------------------------
// MO EVV Accruals + Aggregator — dashboard config
//
// Fill these in once the Jira project and filters exist. Nothing else in
// app.js needs to change — it only reads from window.DASHBOARD_CONFIG.
// ---------------------------------------------------------------------------
window.DASHBOARD_CONFIG = {

  // Human-readable target date shown in the header + used for "days to target"
  // Format: "YYYY-MM-DD"
  targetDate: "", // e.g. "2026-09-30"

  // Jira base URL, e.g. "https://vivtechnologies.atlassian.net"
  jiraBaseUrl: "https://vivtechnologies.atlassian.net",

  // JQL used to populate each panel. These are queried through the Netlify
  // function proxy (see netlify/functions/jira-search.js), never directly
  // from the browser.
  jql: {
    // All MO EVV Accruals + Aggregator tickets still to certify (DEV + QA)
    combined: "",
    // Tickets that have reached a Done status on the target release line
    certified: "",
    // QA pipeline tickets (drives the "QA by status" donut + live QA table)
    qa: "",
    // DEV pipeline tickets (drives the "DEV by status" donut + live DEV table)
    dev: "",
  },

  // Jira filter IDs, used only to build the "Open in Jira ↗" links.
  // Find these in the filter's URL: .../issues/?filter=<ID>
  filterIds: {
    qa: "",
    dev: "",
    certified: "",
  },

  // Default values applied when a ticket is created via the "Open Ticket" modal.
  // The actual creation happens in netlify/functions/jira-create.js, which
  // also needs JIRA_PROJECT_KEY / assignee account IDs set as env vars.
  ticketDefaults: {
    projectKey: "", // e.g. "MOEVV"
  },

  // Poll interval for auto-refresh, in ms. Set to 0 to disable auto-refresh.
  refreshIntervalMs: 5 * 60 * 1000,
};
