(function () {
  "use strict";

  const CFG = window.DASHBOARD_CONFIG || {};
  const DONUT_COLORS = ["#0F766E", "#B45309", "#3B7DD8", "#B42318", "#6D28D9", "#8A968F"];

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
    const s = (statusName || "").toLowerCase();
    if (s.includes("block") || s.includes("fail") || s.includes("reject")) return "red";
    if (s.includes("progress") || s.includes("review") || s.includes("hold")) return "amber";
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
        <td>${escapeHtml(t.release)}</td>
        <td>${escapeHtml(t.assignee)}</td>
        <td>${escapeHtml(t.qaAssignee)}</td>
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

  function renderDonut(svgId, legendId, counts) {
    const svg = $(svgId);
    const legend = $(legendId);
    const entries = Object.entries(counts);
    const total = entries.reduce((sum, [, n]) => sum + n, 0);

    if (!total) {
      svg.innerHTML = `<circle cx="60" cy="60" r="48" fill="none" stroke="#E1E4E0" stroke-width="14"/>`;
      legend.innerHTML = `<li class="loading">No data yet.</li>`;
      return;
    }

    const r = 48;
    const circumference = 2 * Math.PI * r;
    let offset = 0;
    const segments = entries
      .map(([status, count], i) => {
        const frac = count / total;
        const dash = frac * circumference;
        const seg = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${DONUT_COLORS[i % DONUT_COLORS.length]}"
          stroke-width="14" stroke-dasharray="${dash} ${circumference - dash}"
          stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"/>`;
        offset += dash;
        return seg;
      })
      .join("");
    svg.innerHTML = segments;

    legend.innerHTML = entries
      .map(
        ([status, count], i) => `
      <li><span class="swatch" style="background:${DONUT_COLORS[i % DONUT_COLORS.length]}"></span>
        ${escapeHtml(status)} <span class="count">${count}</span></li>`
      )
      .join("");
  }

  function firstSeenDate() {
    const key = "moevv_first_seen";
    let stored = localStorage.getItem(key);
    if (!stored) {
      stored = new Date().toISOString();
      localStorage.setItem(key, stored);
    }
    return new Date(stored);
  }

  function updatePaceStats(certifiedCount, combinedCount) {
    const today = new Date();
    const start = firstSeenDate();
    const elapsedDays = Math.max(1, businessDaysBetween(start, today));
    const burnRate = certifiedCount / elapsedDays;

    $("statBurnRate").textContent = burnRate > 0 ? burnRate.toFixed(2) : "—";

    if (CFG.targetDate) {
      const target = new Date(CFG.targetDate + "T00:00:00");
      const daysLeft = businessDaysBetween(today, target);
      $("statDaysToTarget").textContent = daysLeft >= 0 ? daysLeft : "0";
      $("targetDateLabel").textContent = target.toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric",
      });
    }

    const remaining = Math.max(0, combinedCount - certifiedCount);
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
    } else if (remaining === 0 && combinedCount > 0) {
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

      renderDonut("qaDonut", "qaLegend", statusCounts(qa));
      renderDonut("devDonut", "devLegend", statusCounts(dev));

      renderTable("certifiedTable", certified);
      renderTable("qaTable", qa);
      renderTable("devTable", dev);

      updatePaceStats(certified.length, combined.length);

      if (CFG.jiraBaseUrl && CFG.filterIds) {
        if (CFG.filterIds.qa) $("qaJiraLink").href = `${CFG.jiraBaseUrl}/issues?filter=${CFG.filterIds.qa}`;
        if (CFG.filterIds.dev) $("devJiraLink").href = `${CFG.jiraBaseUrl}/issues?filter=${CFG.filterIds.dev}`;
        if (CFG.filterIds.certified) $("certifiedJiraLink").href = `${CFG.jiraBaseUrl}/issues?filter=${CFG.filterIds.certified}`;
      }

      $("updatedAt").textContent = fmtTime(new Date());
    } catch (err) {
      console.error(err);
      showToast("Couldn't load Jira data — check the Netlify function logs.");
    }
  }

  // ---------------------------------------------------------------------
  // Ticket creation
  // ---------------------------------------------------------------------
  async function submitTicket(e) {
    e.preventDefault();
    const payload = {
      issueType: $("issueType").value,
      summary: $("ticketSummary").value,
      description: $("ticketDescription").value,
      priority: $("ticketPriority").value,
      projectKey: (CFG.ticketDefaults && CFG.ticketDefaults.projectKey) || "",
    };

    try {
      const res = await fetch("/.netlify/functions/jira-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Create failed (${res.status})`);
      closeModal("ticketModalBackdrop");
      $("ticketForm").reset();
      showToast("Ticket submitted ✅");
      loadDashboard();
    } catch (err) {
      console.error(err);
      showToast("Couldn't create the ticket — check the Netlify function logs.");
    }
  }

  // ---------------------------------------------------------------------
  // Modals
  // ---------------------------------------------------------------------
  function openModal(id) { $(id).classList.add("open"); }
  function closeModal(id) { $(id).classList.remove("open"); }

  function wireModals() {
    $("openTicketBtn").addEventListener("click", () => openModal("ticketModalBackdrop"));
    $("ticketModalClose").addEventListener("click", () => closeModal("ticketModalBackdrop"));
    $("ticketCancelBtn").addEventListener("click", () => closeModal("ticketModalBackdrop"));
    $("ticketForm").addEventListener("submit", submitTicket);

    $("faqBtn").addEventListener("click", () => openModal("faqModalBackdrop"));
    $("faqModalClose").addEventListener("click", () => closeModal("faqModalBackdrop"));

    [$("ticketModalBackdrop"), $("faqModalBackdrop")].forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) backdrop.classList.remove("open");
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal("ticketModalBackdrop");
        closeModal("faqModalBackdrop");
      }
    });
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  function init() {
    wireModals();
    $("refreshBtn").addEventListener("click", loadDashboard);
    loadDashboard();
    if (CFG.refreshIntervalMs > 0) {
      setInterval(loadDashboard, CFG.refreshIntervalMs);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
