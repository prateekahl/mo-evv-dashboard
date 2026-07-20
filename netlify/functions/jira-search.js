// GET /.netlify/functions/jira-search?jql=<encoded JQL>
// Proxies a Jira issue search so the API token never reaches the browser.
//
// Uses /rest/api/3/search/jql — Atlassian fully retired the old
// /rest/api/3/search endpoint (it now returns 410 Gone for every site).
// The new endpoint returns { issues, isLast, nextPageToken } instead of
// { issues, total, startAt }; this app only reads `issues`, so no other
// changes were needed. If your ticket counts ever exceed 100 per panel,
// you'll want to follow nextPageToken to fetch subsequent pages.

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
    "summary", "status", "fixVersions", "assignee",
    // If you add a custom field for "QA assignee" in Jira, put its id here
    // e.g. "customfield_10045" — and reference it in app.js's normalizeIssue().
  ];

  try {
    const url = `${JIRA_BASE_URL}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=100&fields=${fields.join(",")}`;
    const res = await fetch(url, {
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
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err.message }) };
  }
};
