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

  function businessDaysBetween(start, end) {
    let count = 0;
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);
    while (cur <= last) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
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
    };
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
      <tr>
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

  function certifiedHistory() {
    const key = "moevv_certified_history";
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch {
      return {};
    }
  }

  function saveCertifiedHistory(hist) {
    localStorage.setItem("moevv_certified_history", JSON.stringify(hist));
  }

  // Rolling 14-day burn rate: (certified today - certified 14 days ago) / 14.
  // We only know "certified 14 days ago" from what this browser has recorded
  // itself (once per calendar day), so the rate reads 0 until 14 days of
  // history have actually been collected — it can't be backfilled from a
  // single snapshot on day one.
  function updateCertifiedHistoryAndGetBurnRate(certifiedCount) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toISOString().slice(0, 10);

    const hist = certifiedHistory();
    if (!(todayKey in hist)) hist[todayKey] = certifiedCount;

    // Keep ~30 days of history, no need to grow forever.
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 30);
    Object.keys(hist).forEach((k) => {
      if (new Date(k + "T00:00:00") < cutoff) delete hist[k];
    });
    saveCertifiedHistory(hist);

    const fourteenAgo = new Date(today);
    fourteenAgo.setDate(fourteenAgo.getDate() - 14);
    const fourteenAgoKey = fourteenAgo.toISOString().slice(0, 10);

    if (!(fourteenAgoKey in hist)) return 0; // not enough history yet

    const diff = certifiedCount - hist[fourteenAgoKey];
    return diff / 14;
  }

  function updatePaceStats(certifiedCount, combinedCount) {
    const today = new Date();
    const burnRate = updateCertifiedHistoryAndGetBurnRate(certifiedCount);

    $("statBurnRate").textContent = burnRate.toFixed(2);

    if (CFG.targetDate) {
      const target = new Date(CFG.targetDate + "T00:00:00");
      const daysLeft = businessDaysBetween(today, target);
      $("statDaysToTarget").textContent = daysLeft >= 0 ? daysLeft : "0";
      const targetLabel = target.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      $("targetDateLabel").textContent = target.toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric",
      });
      $("daysToTargetLabel").textContent = targetLabel;
    }

    // `combined` is already "not yet certified" (statusCategory != Done),
    // so it IS the remaining count — don't subtract certified again.
    const remaining = Math.max(0, combinedCount);
    if (burnRate > 0 && remaining > 0) {
      const daysNeeded = Math.ceil(remaining / burnRate);
      const projected = new Date();
      let added = 0;
      while (added < daysNeeded) {
        projected.setDate(projected.getDate() + 1);
        const day = projected.getDay();
        if (day !== 0 && day !== 6) added++;
      }
      $("statProjectedDone").textContent = projected.toLocaleDateString(undefined, {
        month: "short", day: "numeric",
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
      const [combined, certified, qa, dev] = await Promise.all([
        fetchJQL(CFG.jql.combined),
        fetchJQL(CFG.jql.certified),
        fetchJQL(CFG.jql.qa),
        fetchJQL(CFG.jql.dev),
      ]);

      $("statCombined").textContent = combined.length || "0";
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

      updatePaceStats(certified.length, combined.length);

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
