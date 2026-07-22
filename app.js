(function () {
  "use strict";

  const CFG = window.DASHBOARD_CONFIG || {};

  // ---------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);

  function showToast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 3200);
  }

  function fmtTime(d) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function utcMidnight(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  function businessDaysBetween(start, end) {
    let count = 0;
    const cur = utcMidnight(start);
    const last = utcMidnight(end);
    while (cur <= last) {
      const day = cur.getUTCDay();
      if (day !== 0 && day !== 6) count++;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return count;
  }

  function statusToClass(statusName) {
    const override = CFG.statusColors && CFG.statusColors[statusName];
    if (override) return override;
    const s = (statusName || "").toLowerCase();
    if (s.includes("needs") || s.includes("fail") || s.includes("reject")) return "red";
    if (s.includes("in testing") || s.includes("in progress")) return "green";
    if (s.includes("ready")) return "blue";
    return "";
  }

  // ---------------------------------------------------------------------
  // Jira fetch via Netlify function proxy
  // ---------------------------------------------------------------------
  async function fetchJQL(jql) {
    if (!jql) return [];
    const res = await fetch(`/.netlify/functions/jira-search?jql=${encodeURIComponent(jql)}`);
    if (!res.ok) throw new Error(`Jira search failed (${res.status})`);
    const data = await res.json();
    return (data.issues || []).map(normalizeIssue);
  }

  function normalizeIssue(issue) {
    const f = issue.fields || {};
    return {
      key: issue.key,
      summary: f.summary || "",
      status: f.status ? f.status.name : "",
      release: (f.fixVersions && f.fixVersions.map((v) => v.name).join(", ")) || "—",
      assignee: f.assignee ? f.assignee.displayName : "Unassigned",
      qaAssignee: (f.customfield_qa_assignee && f.customfield_qa_assignee.displayName) || "—",
      parentKey: f.parent ? f.parent.key : null,
    };
  }

  function isCrucial(issue) {
    const epics = CFG.crucialEpics || [];
    return !!issue.parentKey && epics.includes(issue.parentKey);
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------
  function renderTable(bodyId, issues) {
    const body = $(bodyId);
    if (!issues.length) {
      body.innerHTML = `<tr><td colspan="6" class="loading">No tickets found.</td></tr>`;
      return;
    }
    body.innerHTML = issues
      .map(
        (t) => `
      <tr class="${isCrucial(t) ? "crucial-row" : ""}">
        <td class="key">${t.key}</td>
        <td>${escapeHtml(t.summary)}</td>
        <td><span class="status-pill ${statusToClass(t.status)}">${escapeHtml(t.status)}</span></td>
        <td class="muted-cell">${escapeHtml(t.release)}</td>
        <td class="muted-cell" style="font-family: var(--sans); color: var(--muted);">${escapeHtml(t.assignee)}</td>
        <td class="muted-cell" style="font-family: var(--sans); color: var(--muted);">${escapeHtml(t.qaAssignee)}</td>
      </tr>`
      )
      .join("");
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function statusCounts(issues) {
    const counts = {};
    issues.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return counts;
  }

  function renderStatusList(listId, counts) {
    const list = $(listId);
    const entries = Object.entries(counts);
    const total = entries.reduce((sum, [, n]) => sum + n, 0);

    if (!total) {
      list.innerHTML = `<li class="loading">No data yet.</li>`;
      return;
    }

    const rows = entries
      .map(
        ([status, count]) => `
      <li class="status-row-item">
        <span>${escapeHtml(status)}</span>
        <span class="status-badge ${statusToClass(status)}">${count}</span>
      </li>`
      )
      .join("");

    list.innerHTML = `${rows}
      <li class="status-row-item status-total">
        <span>Total</span>
        <span class="status-badge total">${total}</span>
      </li>`;
  }

  // Burn rate = (tickets certified in the trailing 14-calendar-day window)
  // ÷ (working days in that window). "Certified in window" comes straight
  // from Jira via the recentlyCertified JQL (statuscategorychangedate >= -14d),
  // so this reflects real transition history — not a client-side guess.
  function updatePaceStats(certifiedCount, combinedCount, recentlyCertifiedCount) {
    const today = utcMidnight(new Date());

    const windowStart = new Date(today);
    windowStart.setUTCDate(windowStart.getUTCDate() - 14);
    const workingDaysInWindow = businessDaysBetween(windowStart, today);
    const burnRate = workingDaysInWindow > 0 ? recentlyCertifiedCount / workingDaysInWindow : 0;

    $("statBurnRate").textContent = burnRate.toFixed(2);

    if (CFG.targetDate) {
      // Parsed as true UTC midnight — "Z" suffix is what makes this a fixed
      // instant instead of the visitor's local midnight.
      const target = new Date(CFG.targetDate + "T00:00:00Z");
      const daysLeft = businessDaysBetween(today, target);
      $("statDaysToTarget").textContent = daysLeft >= 0 ? daysLeft : "0";
      const targetLabel = target.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
      $("targetDateLabel").textContent = target.toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
      });
      $("daysToTargetLabel").textContent = targetLabel;
    }

    // `combined` is already "not yet certified" (statusCategory != Done),
    // so it IS the remaining count — don't subtract certified again.
    const remaining = Math.max(0, combinedCount);
    if (burnRate > 0 && remaining > 0) {
      const daysNeeded = Math.ceil(remaining / burnRate);
      const projected = utcMidnight(new Date());
      let added = 0;
      while (added < daysNeeded) {
        projected.setUTCDate(projected.getUTCDate() + 1);
        const day = projected.getUTCDay();
        if (day !== 0 && day !== 6) added++;
      }
      $("statProjectedDone").textContent = projected.toLocaleDateString(undefined, {
        month: "short", day: "numeric", timeZone: "UTC",
      });
    } else if (remaining === 0) {
      $("statProjectedDone").textContent = "Done";
    } else {
      $("statProjectedDone").textContent = "—";
    }
  }

  // ---------------------------------------------------------------------
  // Main load
  // ---------------------------------------------------------------------
  async function loadDashboard() {
    if (!CFG.jql || (!CFG.jql.combined && !CFG.jql.qa && !CFG.jql.dev)) {
      showToast("Add your Jira JQL filters to config.js to load live data.");
      return;
    }

    try {
      const [combined, certified, qa, dev, recentlyCertified, crucialCertified, crucialOutstanding] = await Promise.all([
        fetchJQL(CFG.jql.combined),
        fetchJQL(CFG.jql.certified),
        fetchJQL(CFG.jql.qa),
        fetchJQL(CFG.jql.dev),
        fetchJQL(CFG.jql.recentlyCertified),
        fetchJQL(CFG.jql.crucialCertified),
        fetchJQL(CFG.jql.crucialOutstanding),
      ]);

      $("statCombined").textContent = combined.length || "0";
      $("statCombinedCrucial").textContent = `(${crucialOutstanding.length})`;
      $("statCrucialCertified").textContent = crucialCertified.length || "0";
      $("statCertified").textContent = certified.length || "0";
      $("statActioned").textContent = combined.length + certified.length;
      $("certifiedCount").textContent = `${certified.length} certified`;
      $("qaTableCount").textContent = `${qa.length} total`;
      $("devTableCount").textContent = `${dev.length} total`;

      renderStatusList("qaStatusList", statusCounts(qa));
      renderStatusList("devStatusList", statusCounts(dev));

      renderTable("certifiedTable", certified);
      renderTable("qaTable", qa);
      renderTable("devTable", dev);

      updatePaceStats(certified.length, combined.length, recentlyCertified.length);

      $("updatedAt").textContent = fmtTime(new Date());
    } catch (err) {
      console.error(err);
      showToast("Couldn't load Jira data — check the Netlify function logs.");
    }
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  function init() {
    $("refreshBtn").addEventListener("click", loadDashboard);
    loadDashboard();
    if (CFG.refreshIntervalMs > 0) {
      setInterval(loadDashboard, CFG.refreshIntervalMs);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
