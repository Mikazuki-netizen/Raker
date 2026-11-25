/**
 * Interactive Field Map & Synchronized Rundown Timeline.
 * Menghasilkan titik rute secara dinamis dari tab Rundown Spreadsheet.
 */
window.RakerFieldMap = (function () {
  const PHASE_COLORS = {
    berangkat: "#d97706",
    hotel: "#2563eb",
    raker: "#0f766e",
    ishoma: "#b91c1c",
    budaya: "#b91c1c",
    pulang: "#475569"
  };

  const PHASE_LABELS = {
    berangkat: "Keberangkatan",
    hotel: "De Djokja Hotel",
    raker: "Sesi Raker",
    ishoma: "Ishoma",
    budaya: "Malam Budaya",
    pulang: "Kepulangan"
  };

  let allItems = [];
  let visibleItems = [];
  let activeDay = "ALL";
  let searchQuery = "";
  let selectedId = null;

  const els = {};

  function cacheDom() {
    els.tabsContainer = document.getElementById("day-filter-tabs");
    els.tabIndicator = document.getElementById("day-tab-indicator");
    els.pinsLayer = document.getElementById("map-pins-layer");
    els.basePath = document.getElementById("route-base-path");
    els.activePath = document.getElementById("route-active-path");
    els.activeHalo = document.getElementById("active-pin-halo");
    els.stepCounter = document.getElementById("map-step-counter");
    els.prevBtn = document.getElementById("btn-prev-stop");
    els.nextBtn = document.getElementById("btn-next-stop");
    els.rundownList = document.getElementById("rundown-list");
    els.rundownCount = document.getElementById("rundown-visible-count");
    els.rundownSearch = document.getElementById("rundown-search");
    els.inspector = document.getElementById("checkpoint-inspector");
    els.inspDay = document.getElementById("insp-day");
    els.inspPhase = document.getElementById("insp-phase");
    els.inspTime = document.getElementById("insp-time");
    els.inspStatus = document.getElementById("insp-status");
    els.inspTitle = document.getElementById("insp-title");
    els.inspDesc = document.getElementById("insp-desc");
    els.inspLocation = document.getElementById("insp-location");
    els.inspPic = document.getElementById("insp-pic");
    els.inspDress = document.getElementById("insp-dress");
  }

  function init(items) {
    cacheDom();
    bindEvents();
    setData(items);
    updateTabIndicator();
  }

  function bindEvents() {
    if (els.tabsContainer) {
      els.tabsContainer.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-day]");
        if (!btn) return;
        selectDay(btn.getAttribute("data-day"));
      });
    }

    if (els.rundownSearch) {
      els.rundownSearch.addEventListener("input", (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        applyFilter();
      });
    }

    if (els.prevBtn) {
      els.prevBtn.addEventListener("click", () => stepBy(-1));
    }
    if (els.nextBtn) {
      els.nextBtn.addEventListener("click", () => stepBy(1));
    }

    window.addEventListener("resize", updateTabIndicator);
  }

  function setData(items) {
    allItems = Array.isArray(items) ? items : [];
    applyFilter();
  }

  function selectDay(day) {
    activeDay = day || "ALL";
    if (els.tabsContainer) {
      const buttons = els.tabsContainer.querySelectorAll("[data-day]");
      buttons.forEach((btn) => {
        const isMatch = btn.getAttribute("data-day") === activeDay;
        btn.classList.toggle("is-active", isMatch);
        btn.setAttribute("aria-selected", isMatch ? "true" : "false");
      });
    }
    updateTabIndicator();
    applyFilter();
  }

  function updateTabIndicator() {
    if (!els.tabsContainer || !els.tabIndicator) return;
    const activeBtn = els.tabsContainer.querySelector(".segmented-tab.is-active");
    if (!activeBtn) return;
    const x = activeBtn.offsetLeft - 4;
    const w = activeBtn.offsetWidth;
    els.tabIndicator.style.width = w + "px";
    els.tabIndicator.style.transform = "translateX(" + x + "px)";
  }

  function applyFilter() {
    visibleItems = allItems.filter((item) => {
      const matchesDay =
        activeDay === "ALL" ||
        item.hari.toLowerCase() === activeDay.toLowerCase();
      if (!matchesDay) return false;
      if (!searchQuery) return true;
      const haystack = [item.judul, item.lokasi, item.pic, item.keterangan, item.hari]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchQuery);
    });

    if (!visibleItems.some((item) => item.id === selectedId)) {
      selectedId = visibleItems.length ? visibleItems[0].id : null;
    }

    renderAll();
  }

  /**
   * Menghitung koordinat SVG (920x520) secara otomatis berdasarkan fase acara
   * sehingga perubahan atau penambahan baris di Spreadsheet langsung tertata rapi.
   */
  function computeCoordinates(items) {
    const groups = {
      berangkat: [],
      hotelEarly: [],
      raker: [],
      budaya: [],
      hotelLate: [],
      pulang: []
    };

    const midpoint = Math.floor(items.length / 2);

    items.forEach((item, idx) => {
      if (item.fase === "berangkat") groups.berangkat.push(idx);
      else if (item.fase === "pulang") groups.pulang.push(idx);
      else if (item.fase === "hotel") {
        if (idx <= midpoint && !item.judul.toLowerCase().includes("out")) {
          groups.hotelEarly.push(idx);
        } else {
          groups.hotelLate.push(idx);
        }
      } else if (item.fase === "ishoma" || item.fase === "budaya") {
        groups.budaya.push(idx);
      } else {
        groups.raker.push(idx);
      }
    });

    const coords = new Array(items.length);

    const placeLine = (indices, x1, y1, x2, y2) => {
      const count = indices.length;
      indices.forEach((itemIdx, pos) => {
        const t = count === 1 ? 0.5 : pos / (count - 1);
        coords[itemIdx] = {
          x: Math.round(x1 + (x2 - x1) * t),
          y: Math.round(y1 + (y2 - y1) * t)
        };
      });
    };

    placeLine(groups.berangkat, 95, 138, 250, 168);
    placeLine(groups.hotelEarly, 395, 160, 428, 172);
    placeLine(groups.raker, 515, 146, 675, 198);
    placeLine(groups.budaya, 435, 252, 585, 256);
    placeLine(groups.hotelLate, 395, 342, 345, 366);
    placeLine(groups.pulang, 250, 398, 135, 420);

    // Override if explicit coordinates exist in spreadsheet
    items.forEach((item, idx) => {
      if (item.koordinat_x && item.koordinat_y) {
        coords[idx] = { x: item.koordinat_x, y: item.koordinat_y };
      }
      // Micro-offset if multiple raker items stack closely in grid
      if (item.fase === "raker" && groups.raker.length > 3 && !item.koordinat_x) {
        const pos = groups.raker.indexOf(idx);
        const col = pos % 3;
        const row = Math.floor(pos / 3);
        coords[idx] = {
          x: 515 + col * 82,
          y: 146 + row * 48
        };
      }
    });

    return coords;
  }

  function buildSmoothPath(points) {
    if (!points.length) return "";
    if (points.length === 1) return "M " + points[0].x + " " + points[0].y;
    let d = "M " + points[0].x + " " + points[0].y;
    for (let i = 0; i < points.length - 1; i += 1) {
      const curr = points[i];
      const next = points[i + 1];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;
      d += " Q " + curr.x + " " + curr.y + ", " + midX + " " + midY;
    }
    const last = points[points.length - 1];
    d += " T " + last.x + " " + last.y;
    return d;
  }

  function renderAll() {
    const coords = computeCoordinates(visibleItems);
    renderMap(coords);
    renderList();
    renderInspector();
  }

  function renderMap(coords) {
    if (!els.pinsLayer || !els.basePath || !els.activePath) return;

    const selectedIdx = visibleItems.findIndex((i) => i.id === selectedId);

    els.basePath.setAttribute("d", buildSmoothPath(coords));

    if (selectedIdx >= 0) {
      els.activePath.setAttribute("d", buildSmoothPath(coords.slice(0, selectedIdx + 1)));
      const targetPt = coords[selectedIdx];
      if (els.activeHalo && targetPt) {
        els.activeHalo.style.opacity = "1";
        els.activeHalo.style.transform = "translate(" + targetPt.x + "px, " + targetPt.y + "px)";
      }
    } else {
      els.activePath.setAttribute("d", "");
      if (els.activeHalo) els.activeHalo.style.opacity = "0";
    }

    els.pinsLayer.innerHTML = "";
    const svgNs = "http://www.w3.org/2000/svg";

    visibleItems.forEach((item, idx) => {
      const pt = coords[idx];
      if (!pt) return;
      const isSelected = item.id === selectedId;
      const color = PHASE_COLORS[item.fase] || PHASE_COLORS.raker;

      const g = document.createElementNS(svgNs, "g");
      g.setAttribute("class", "map-pin" + (isSelected ? " is-active" : ""));
      g.setAttribute("transform", "translate(" + pt.x + ", " + pt.y + ")");
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", item.hari + " " + item.waktu + " - " + item.judul);

      // Larger invisible hit area (44px+ accessible target)
      const hit = document.createElementNS(svgNs, "circle");
      hit.setAttribute("r", "22");
      hit.setAttribute("fill", "transparent");

      const circle = document.createElementNS(svgNs, "circle");
      circle.setAttribute("r", "13");
      circle.setAttribute("fill", color);
      circle.setAttribute("class", "map-pin-circle");

      const num = document.createElementNS(svgNs, "text");
      num.setAttribute("y", "3.5");
      num.setAttribute("text-anchor", "middle");
      num.setAttribute("class", "map-pin-num");
      num.textContent = String(idx + 1).padStart(2, "0");

      const shortTitle = item.judul.length > 20 ? item.judul.slice(0, 19) + "…" : item.judul;
      const labelWidth = Math.max(70, shortTitle.length * 5.6 + 14);
      const labelY = idx % 2 === 0 ? -28 : 18;

      const labelBg = document.createElementNS(svgNs, "rect");
      labelBg.setAttribute("x", String(-labelWidth / 2));
      labelBg.setAttribute("y", String(labelY));
      labelBg.setAttribute("width", String(labelWidth));
      labelBg.setAttribute("height", "16");
      labelBg.setAttribute("rx", "5");
      labelBg.setAttribute("class", "map-pin-label-bg");

      const labelTxt = document.createElementNS(svgNs, "text");
      labelTxt.setAttribute("y", String(labelY + 11));
      labelTxt.setAttribute("text-anchor", "middle");
      labelTxt.setAttribute("class", "map-pin-label");
      labelTxt.textContent = shortTitle;

      g.appendChild(hit);
      g.appendChild(circle);
      g.appendChild(num);
      if (isSelected || visibleItems.length <= 8) {
        g.appendChild(labelBg);
        g.appendChild(labelTxt);
      }

      const selectThis = () => selectStop(item.id, true);
      g.addEventListener("click", selectThis);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectThis();
        }
      });

      els.pinsLayer.appendChild(g);
    });

    if (els.stepCounter) {
      els.stepCounter.textContent = visibleItems.length
        ? "Pos " + (selectedIdx + 1) + " / " + visibleItems.length
        : "0 Pos";
    }

    if (els.prevBtn) els.prevBtn.disabled = selectedIdx <= 0;
    if (els.nextBtn) els.nextBtn.disabled = selectedIdx < 0 || selectedIdx >= visibleItems.length - 1;
  }

  function renderList() {
    if (!els.rundownList) return;
    if (els.rundownCount) {
      els.rundownCount.textContent = visibleItems.length + " agenda";
    }

    if (!visibleItems.length) {
      els.rundownList.innerHTML = '<div class="empty-state">Tidak ada agenda yang cocok dengan filter saat ini.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    visibleItems.forEach((item, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rundown-item" + (item.id === selectedId ? " is-active" : "");
      btn.setAttribute("data-rundown-id", item.id);

      const color = PHASE_COLORS[item.fase] || PHASE_COLORS.raker;
      btn.innerHTML =
        '<span class="ri-index" style="background:' + color + '">' + String(idx + 1).padStart(2, "0") + "</span>" +
        '<div>' +
          '<div class="ri-top">' +
            "<span>" + escapeHtml(item.hari) + (item.tanggal ? " · " + escapeHtml(item.tanggal) : "") + "</span>" +
            '<span class="ri-time">' + escapeHtml(item.waktu) + "</span>" +
          "</div>" +
          '<div class="ri-title">' + escapeHtml(item.judul) + "</div>" +
          '<div class="ri-loc">' + escapeHtml(item.lokasi) + "</div>" +
        "</div>";

      btn.addEventListener("click", () => selectStop(item.id, false));
      fragment.appendChild(btn);
    });

    els.rundownList.innerHTML = "";
    els.rundownList.appendChild(fragment);
  }

  function renderInspector() {
    const item = visibleItems.find((i) => i.id === selectedId);
    if (!item) {
      els.inspTitle.textContent = "Tidak ada agenda terpilih";
      els.inspDesc.textContent = "Pilih hari atau reset pencarian untuk melihat rute acara.";
      els.inspDay.textContent = "-";
      els.inspPhase.textContent = "-";
      els.inspTime.textContent = "-";
      els.inspStatus.textContent = "-";
      els.inspLocation.textContent = "-";
      els.inspPic.textContent = "-";
      els.inspDress.textContent = "-";
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion && els.inspector) {
      els.inspector.classList.add("is-swapping");
      requestAnimationFrame(() => {
        els.inspector.classList.remove("is-swapping");
      });
    }

    els.inspDay.textContent = item.hari + (item.tanggal ? " · " + item.tanggal : "");
    els.inspPhase.textContent = PHASE_LABELS[item.fase] || item.fase;
    els.inspTime.textContent = item.waktu;
    els.inspStatus.textContent = item.status || "Terjadwal";
    els.inspTitle.textContent = item.judul;
    els.inspDesc.textContent = item.keterangan;
    els.inspLocation.textContent = item.lokasi;
    els.inspPic.textContent = item.pic;
    els.inspDress.textContent = item.dress_code;
  }

  function selectStop(id, scrollListIntoView) {
    selectedId = id;
    renderAll();
    if (scrollListIntoView && els.rundownList) {
      const targetRow = els.rundownList.querySelector('[data-rundown-id="' + CSS.escape(id) + '"]');
      if (targetRow) {
        targetRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }

  function stepBy(delta) {
    if (!visibleItems.length) return;
    const idx = visibleItems.findIndex((i) => i.id === selectedId);
    const nextIdx = Math.max(0, Math.min(visibleItems.length - 1, idx + delta));
    selectStop(visibleItems[nextIdx].id, true);
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
    selectDay,
    stepBy
  };
})();
