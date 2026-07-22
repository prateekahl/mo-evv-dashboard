// GET /.netlify/functions/jira-search?jql=<encoded JQL>
// Proxies a Jira issue search so the API token never reaches the browser.
//
// Uses /rest/api/3/search/jql — Atlassian fully retired the old
// /rest/api/3/search endpoint (it now returns 410 Gone for every site).
// The new endpoint pages results via nextPageToken instead of the old
// startAt/total model, and caps each page at 100 issues — so this loops
// through every page and returns the full combined issue list, rather
// than silently truncating at 100.

exports.handler = async (event) => {
  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN env vars" }),
    };
  }

  const jql = event.queryStringParameters && event.queryStringParameters.jql;
  if (!jql) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing jql query param" }) };
  }

  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  const fields = [
    "summary", "status", "fixVersions", "assignee", "parent",
    // If you add a custom field for "QA assignee" in Jira, put its id here
    // e.g. "customfield_10045" — and reference it in app.js's normalizeIssue().
  ];

  const MAX_PAGES = 20; // safety cap: 20 pages * 100 = 2,000 issues max

  try {
    let allIssues = [];
    let nextPageToken = null;
    let page = 0;

    do {
      const params = new URLSearchParams({
        jql,
        maxResults: "100",
        fields: fields.join(","),
      });
      if (nextPageToken) params.set("nextPageToken", nextPageToken);

      const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/search/jql?${params.toString()}`, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text();
        return { statusCode: res.status, body: JSON.stringify({ error: text }) };
      }

      const data = await res.json();
      allIssues = allIssues.concat(data.issues || []);
      nextPageToken = data.isLast ? null : data.nextPageToken;
      page++;
    } while (nextPageToken && page < MAX_PAGES);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issues: allIssues }),
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err.message }) };
  }
};
