// POST /.netlify/functions/jira-create
// Body: { issueType, summary, description, priority, projectKey }
// Creates a Jira issue using preset DEV/QA assignees from env vars.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const {
    JIRA_BASE_URL,
    JIRA_EMAIL,
    JIRA_API_TOKEN,
    JIRA_PROJECT_KEY,
    JIRA_DEV_ASSIGNEE_ACCOUNT_ID,
    JIRA_QA_ASSIGNEE_ACCOUNT_ID,
  } = process.env;

  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN env vars" }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { issueType, summary, description, priority } = payload;
  const projectKey = payload.projectKey || JIRA_PROJECT_KEY;

  if (!projectKey || !issueType || !summary || !description || !priority) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

  const body = {
    fields: {
      project: { key: projectKey },
      summary,
      issuetype: { name: issueType },
      priority: { name: priority },
      description: {
        type: "doc",
        version: 1,
        content: [
          { type: "paragraph", content: [{ type: "text", text: description }] },
        ],
      },
      // Assignee defaults to the DEV assignee on creation; adjust to taste.
      ...(JIRA_DEV_ASSIGNEE_ACCOUNT_ID
        ? { assignee: { accountId: JIRA_DEV_ASSIGNEE_ACCOUNT_ID } }
        : {}),
      // If your project has a custom "QA assignee" field, set it here, e.g.:
      // customfield_10045: { accountId: JIRA_QA_ASSIGNEE_ACCOUNT_ID },
    },
  };

  try {
    const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify(data) };
    }

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err.message }) };
  }
};
