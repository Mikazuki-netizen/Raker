/**
 * Interactive Participant Table:
 * Search, multi-filter (Divisi, Transport, Status), column sorting,
 * participant detail modal, KPI summary, and CSV export.
 */
window.RakerParticipants = (function () {
  let allParticipants = [];
  let filteredParticipants = [];
  let sortKey = "no";
  let sortDir = "asc";
  let onRowInspect = null;

  const filters = {
    query: "",
    divisi: "ALL",
    transport: "ALL",
    status: "ALL"
  };

  const els = {};

  function cacheDom() {
    els.tbody = document.getElementById("peserta-tbody");
    els.table = document.getElementById("peserta-table");
    els.search = document.getElementById("peserta-search");
    els.divisi = document.getElementById("filter-divisi");
    els.transport = document.getElementById("filter-transport");
    els.status = document.getElementById("filter-status");
    els.showing = document.getElementById("table-showing-text");
    els.resetBtn = document.getElementById("btn-reset-filters");
    els.exportBtn = document.getElementById("btn-export-peserta");
    els.kpiTotal = document.getElementById("kpi-total");
    els.kpiConfirmed = document.getElementById("kpi-confirmed");
    els.kpiPending = document.getElementById("kpi-pending");
    els.kpiDivisions = document.getElementById("kpi-divisions");
  }

  function init(items, inspectCallback) {
    onRowInspect = inspectCallback;
    cacheDom();
    bindEvents();
    setData(items);
  }

  function bindEvents() {
    if (els.search) {
      els.search.addEventListener("input", (e) => {
        filters.query = e.target.value.trim().toLowerCase();
        applyAndRender();
      });
    }

    if (els.divisi) {
      els.divisi.addEventListener("change", (e) => {
        filters.divisi = e.target.value;
        applyAndRender();
      });
    }

    if (els.transport) {
      els.transport.addEventListener("change", (e) => {
        filters.transport = e.target.value;
        applyAndRender();
      });
    }

    if (els.status) {
      els.status.addEventListener("change", (e) => {
        filters.status = e.target.value;
        applyAndRender();
      });
    }

    if (els.resetBtn) {
      els.resetBtn.addEventListener("click", resetFilters);
    }

    if (els.exportBtn) {
      els.exportBtn.addEventListener("click", exportCurrentCsv);
    }

    if (els.table) {
      const headers = els.table.querySelectorAll("th.sortable");
      headers.forEach((th) => {
        th.addEventListener("click", () => {
          const key = th.getAttribute("data-sort");
          if (sortKey === key) {
            sortDir = sortDir === "asc" ? "desc" : "asc";
          } else {
            sortKey = key;
            sortDir = "asc";
          }
          updateSortIndicators();
          applyAndRender();
        });
      });
    }
  }

  function setData(items) {
    allParticipants = Array.isArray(items) ? items : [];
    populateFilterOptions();
    updateKpis();
    applyAndRender();
  }

  function populateFilterOptions() {
    fillSelect(els.divisi, "Semua Divisi", uniqueValues("divisi"));
    fillSelect(els.transport, "Semua Transport", uniqueValues("kelompok_transport"));
    fillSelect(els.status, "Semua Status", uniqueValues("status"));
  }

  function uniqueValues(key) {
    const set = new Set();
    allParticipants.forEach((p) => {
      const val = String(p[key] || "").trim();
      if (val && val !== "-") set.add(val);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function fillSelect(selectEl, defaultLabel, values) {
    if (!selectEl) return;
    const prev = selectEl.value;
    selectEl.innerHTML = '<option value="ALL">' + defaultLabel + "</option>";
    values.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    });
    if (values.includes(prev)) selectEl.value = prev;
  }

  function updateKpis() {
    const total = allParticipants.length;
    const confirmed = allParticipants.filter((p) =>
      p.status.toLowerCase().includes("konfirm") || p.status.toLowerCase().includes("hadir")
    ).length;
    const pending = total - confirmed;
    const divisions = uniqueValues("divisi").length;

    if (els.kpiTotal) els.kpiTotal.textContent = String(total);
    if (els.kpiConfirmed) els.kpiConfirmed.textContent = String(confirmed);
    if (els.kpiPending) els.kpiPending.textContent = String(pending);
    if (els.kpiDivisions) els.kpiDivisions.textContent = String(divisions);
  }

  function updateSortIndicators() {
    if (!els.table) return;
    els.table.querySelectorAll("th.sortable").forEach((th) => {
      const key = th.getAttribute("data-sort");
      const arrow = th.querySelector(".sort-arrow");
      th.classList.remove("is-sorted-asc", "is-sorted-desc");
      if (key === sortKey) {
        th.classList.add(sortDir === "asc" ? "is-sorted-asc" : "is-sorted-desc");
        if (arrow) arrow.textContent = sortDir === "asc" ? "↑" : "↓";
      } else if (arrow) {
        arrow.textContent = "↕";
      }
    });
  }

  function applyAndRender() {
    filteredParticipants = allParticipants.filter((p) => {
      if (filters.divisi !== "ALL" && p.divisi !== filters.divisi) return false;
      if (filters.transport !== "ALL" && p.kelompok_transport !== filters.transport) return false;
      if (filters.status !== "ALL" && p.status !== filters.status) return false;

      if (!filters.query) return true;
      const haystack = [
        p.no,
        p.nama,
        p.jabatan,
        p.divisi,
        p.kelompok_transport,
        p.no_kamar,
        p.status,
        p.catatan
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(filters.query);
    });

    filteredParticipants.sort((a, b) => {
      const valA = String(a[sortKey] || "");
      const valB = String(b[sortKey] || "");
      const numA = Number(valA);
      const numB = Number(valB);
      let cmp = 0;
      if (!Number.isNaN(numA) && !Number.isNaN(numB) && valA !== "" && valB !== "") {
        cmp = numA - numB;
      } else {
        cmp = valA.localeCompare(valB, "id", { numeric: true, sensitivity: "base" });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    renderTable();
  }

  function renderTable() {
    if (!els.tbody) return;

    const hasActiveFilter =
      filters.query !== "" ||
      filters.divisi !== "ALL" ||
      filters.transport !== "ALL" ||
      filters.status !== "ALL";

    if (els.resetBtn) {
      els.resetBtn.hidden = !hasActiveFilter;
    }

    if (els.showing) {
      els.showing.textContent =
        "Menampilkan " +
        filteredParticipants.length +
        " dari " +
        allParticipants.length +
        " peserta";
    }

    if (!filteredParticipants.length) {
      els.tbody.innerHTML =
        '<tr><td colspan="7" class="empty-state">Tidak ada peserta yang sesuai dengan pencarian atau filter.</td></tr>';
      return;
    }

    const fragment = document.createDocumentFragment();
    filteredParticipants.forEach((p) => {
      const tr = document.createElement("tr");
      tr.setAttribute("tabindex", "0");
      tr.setAttribute("aria-label", "Lihat detail " + p.nama);

      const initials = getInitials(p.nama);
      const statusClass = getStatusClass(p.status);

      tr.innerHTML =
        '<td class="td-mono">' + escapeHtml(p.no) + "</td>" +
        '<td><div class="participant-name-cell"><span class="avatar-mini" aria-hidden="true">' + escapeHtml(initials) + "</span><strong>" + escapeHtml(p.nama) + "</strong></div></td>" +
        "<td>" + escapeHtml(p.jabatan) + "</td>" +
        "<td>" + escapeHtml(p.divisi) + "</td>" +
        "<td>" + escapeHtml(p.kelompok_transport) + "</td>" +
        '<td class="td-mono">' + escapeHtml(p.no_kamar) + "</td>" +
        '<td><span class="status-pill ' + statusClass + '">' + escapeHtml(p.status) + "</span></td>";

      const openRow = () => {
        if (typeof onRowInspect === "function") onRowInspect(p);
      };
      tr.addEventListener("click", openRow);
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openRow();
        }
      });

      fragment.appendChild(tr);
    });

    els.tbody.innerHTML = "";
    els.tbody.appendChild(fragment);
  }

  function resetFilters() {
    filters.query = "";
    filters.divisi = "ALL";
    filters.transport = "ALL";
    filters.status = "ALL";
    if (els.search) els.search.value = "";
    if (els.divisi) els.divisi.value = "ALL";
    if (els.transport) els.transport.value = "ALL";
    if (els.status) els.status.value = "ALL";
    applyAndRender();
  }

  function exportCurrentCsv() {
    const headers = [
      "no",
      "nama",
      "jabatan",
      "divisi",
      "kelompok_transport",
      "no_kamar",
      "kontak",
      "ukuran_seragam",
      "status",
      "catatan"
    ];
    const csv = window.RakerCsv.stringify(headers, filteredParticipants);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "daftar-peserta-raker-2026.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function getInitials(name) {
    const parts = String(name || "").trim().split(/\s+/);
    if (!parts.length || !parts[0]) return "PS";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function getStatusClass(status) {
    const s = String(status || "").toLowerCase();
    if (s.includes("konfirm") || s.includes("hadir")) return "is-confirmed";
    if (s.includes("batal") || s.includes("berhalangan") || s.includes("tidak")) return "is-absent";
    return "is-pending";
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return {
    init,
    setData,
    getInitials,
    getStatusClass
  };
})();
