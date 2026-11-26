/**
 * Interactive Cinematic Expedition Map & Synchronized Rundown Timeline.
 * - One physical location = one marker (Location Grouping).
 * - Preserves Google Sheets dynamic data & existing API (init, setData, selectDay, stepBy).
 * - Progressive SVG route drawing, animated SIBA SURYA bus, and 800ms camera pan/zoom.
 */
window.RakerFieldMap = (function () {
  const PHASE_COLORS = {
    berangkat: "#d97706",
    hotel: "#C82027",
    raker: "#0f766e",
    ishoma: "#b91c1c",
    budaya: "#89502E",
    pulang: "#475569"
  };

  const PHASE_LABELS = {
    berangkat: "Keberangkatan",
    hotel: "De Djokja Hotel",
    raker: "Sesi Raker",
    ishoma: "Ishoma",
    budaya: "Wisata / Budaya",
    pulang: "Kepulangan"
  };

  // Physical venues on the Central Java (Semarang -> Yogyakarta) Expedition Map
  const VENUES = {
    SEM: {
      id: "SEM",
      name: "Semarang",
      typeLabel: "Keberangkatan & Kepulangan",
      x: 425,
      y: 112,
      color: "#d97706",
      confirmed: true
    },
    HOTEL: {
      id: "HOTEL",
      name: "De Djokja Hotel",
      typeLabel: "Main Venue · Yogyakarta",
      x: 430,
      y: 368,
      color: "#C82027",
      confirmed: true
    },
    RESTO: {
      id: "RESTO",
      name: "External Restaurant",
      typeLabel: "Restoran Eksternal",
      x: 625,
      y: 326,
      color: "#B58A53",
      confirmed: false,
      statusText: "Menunggu Konfirmasi Lokasi"
    },
    TOURISM_01: {
      id: "TOURISM_01",
      name: "Tourism Destination 1",
      typeLabel: "Wisata & Oleh-oleh",
      x: 275,
      y: 386,
      color: "#B58A53",
      confirmed: false,
      statusText: "Menunggu Kepastian Destinasi"
    },
    TOURISM_02: {
      id: "TOURISM_02",
      name: "Destinasi Tambahan",
      typeLabel: "Wisata Opsional",
      x: 570,
      y: 428,
      color: "#89502E",
      confirmed: false,
      statusText: "Opsional"
    }
  };

  const OVERVIEW_VIEWBOX = { x: 0, y: 0, w: 920, h: 520 };
  let currentViewBox = { ...OVERVIEW_VIEWBOX };
  let cameraAnimId = null;
  let busAnimId = null;

  let allItems = [];
  let visibleItems = [];
  let locationGroups = [];
  let activeDay = "ALL";
  let searchQuery = "";
  let selectedId = null;
  let selectedLocationId = null;
  let panelDayFilter = "ALL";

  const els = {};

  function cacheDom() {
    els.tabsContainer = document.getElementById("day-filter-tabs");
    els.tabIndicator = document.getElementById("day-tab-indicator");
    els.svg = document.getElementById("fieldmap-svg");
    els.pinsLayer = document.getElementById("map-pins-layer");
    els.basePath = document.getElementById("route-base-path");
    els.activePath = document.getElementById("route-active-path");
    els.unconfirmedPath = document.getElementById("route-unconfirmed-path");
    els.vehicleBus = document.getElementById("map-vehicle-bus");
    els.activeHalo = document.getElementById("active-pin-halo");
    els.stepCounter = document.getElementById("map-step-counter");
    els.prevBtn = document.getElementById("btn-prev-stop");
    els.nextBtn = document.getElementById("btn-next-stop");
    els.resetZoomBtn = document.getElementById("btn-reset-zoom");
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
    // Location Detail Panel
    els.ldp = document.getElementById("location-detail-panel");
    els.ldpType = document.getElementById("ldp-type");
    els.ldpStatus = document.getElementById("ldp-status");
    els.ldpTitle = document.getElementById("ldp-title");
    els.ldpClose = document.getElementById("ldp-close");
    els.ldpDayTabs = document.getElementById("ldp-day-tabs");
    els.ldpList = document.getElementById("ldp-activity-list");
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

    if (els.prevBtn) els.prevBtn.addEventListener("click", () => stepBy(-1));
    if (els.nextBtn) els.nextBtn.addEventListener("click", () => stepBy(1));

    if (els.resetZoomBtn) {
      els.resetZoomBtn.addEventListener("click", () => {
        closeLocationPanel(true);
      });
    }

    if (els.ldpClose) {
      els.ldpClose.addEventListener("click", () => {
        closeLocationPanel(true);
      });
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
    focusDayCamera();
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

  function resolveLocationId(item) {
    if (item.location_id && VENUES[item.location_id]) return item.location_id;
    const loc = (item.lokasi || "").toLowerCase();
    const title = (item.judul || "").toLowerCase();
    if (item.fase === "berangkat" || item.fase === "pulang" || loc.includes("semarang")) return "SEM";
    if (loc.includes("resto") && !loc.includes("djokja") || loc.includes("external")) return "RESTO";
    if (loc.includes("tambahan") || title.includes("additional") || title.includes("opsional")) return "TOURISM_02";
    if (loc.includes("wisata") || loc.includes("tourism") || title.includes("wisata") || title.includes("oleh-oleh")) return "TOURISM_01";
    return "HOTEL";
  }

  function applyFilter() {
    visibleItems = allItems.filter((item) => {
      const matchesDay =
        activeDay === "ALL" ||
        (item.hari || "").toLowerCase() === activeDay.toLowerCase();
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

    const activeItem = visibleItems.find((i) => i.id === selectedId);
    selectedLocationId = activeItem ? resolveLocationId(activeItem) : null;

    locationGroups = buildLocationGroups(visibleItems);
    renderAll();
  }

  function buildLocationGroups(items) {
    const map = new Map();
    items.forEach((item) => {
      const locId = resolveLocationId(item);
      const venue = VENUES[locId] || VENUES.HOTEL;
      if (!map.has(locId)) {
        map.set(locId, {
          venue,
          items: [],
          days: new Set(),
          hasUnconfirmed: !venue.confirmed
        });
      }
      const grp = map.get(locId);
      grp.items.push(item);
      if (item.hari) grp.days.add(item.hari);
      if (
        item.location_status &&
        item.location_status !== "confirmed" &&
        item.location_status !== ""
      ) {
        grp.hasUnconfirmed = true;
      }
    });
    return Array.from(map.values());
  }

  function buildCurve(p1, p2, bend = -28) {
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2 + bend;
    return "M " + p1.x + " " + p1.y + " Q " + mx + " " + my + ", " + p2.x + " " + p2.y;
  }

  function renderAll() {
    renderRoutesAndVehicle();
    renderMarkers();
    renderList();
    renderInspector();
    if (els.ldp && !els.ldp.hidden && selectedLocationId) {
      renderLocationPanel(selectedLocationId);
    }
  }

  function renderRoutesAndVehicle() {
    if (!els.basePath || !els.activePath || !els.unconfirmedPath) return;

    const sem = VENUES.SEM;
    const hotel = VENUES.HOTEL;
    const resto = VENUES.RESTO;
    const t1 = VENUES.TOURISM_01;
    const t2 = VENUES.TOURISM_02;

    const hasSem = locationGroups.some((g) => g.venue.id === "SEM");
    const hasHotel = locationGroups.some((g) => g.venue.id === "HOTEL");
    const hasResto = locationGroups.some((g) => g.venue.id === "RESTO");
    const hasT1 = locationGroups.some((g) => g.venue.id === "TOURISM_01");
    const hasT2 = locationGroups.some((g) => g.venue.id === "TOURISM_02");

    // Confirmed Semarang <-> De Djokja Hotel route
    let confirmedD = "";
    if (hasSem && hasHotel) {
      const isReturnOnly = activeDay === "Day 3";
      confirmedD = isReturnOnly
        ? buildCurve(hotel, sem, 36)
        : buildCurve(sem, hotel, -36);
    }
    els.basePath.setAttribute("d", confirmedD);
    els.activePath.setAttribute("d", confirmedD);

    // Progressive SVG path draw animation
    if (confirmedD && els.activePath.getTotalLength) {
      const len = els.activePath.getTotalLength();
      els.activePath.style.strokeDasharray = String(len);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        els.activePath.style.strokeDashoffset = String(len);
        requestAnimationFrame(() => {
          els.activePath.style.transition = "stroke-dashoffset 800ms cubic-bezier(0.645, 0.045, 0.355, 1)";
          els.activePath.style.strokeDashoffset = "0";
        });
      } else {
        els.activePath.style.strokeDashoffset = "0";
      }
    }

    // Unconfirmed placeholder dashed segments (never claim exact geography)
    let unconfD = "";
    if (hasHotel && hasResto) unconfD += buildCurve(hotel, resto, -18) + " ";
    if (hasHotel && hasT1) unconfD += buildCurve(hotel, t1, 20) + " ";
    if (hasT1 && hasT2) unconfD += buildCurve(t1, t2, 24) + " ";
    els.unconfirmedPath.setAttribute("d", unconfD.trim());

    // Animate SIBA SURYA Bus along confirmed route
    animateBusAlongRoute(confirmedD);
  }

  function animateBusAlongRoute(pathD) {
    if (busAnimId) {
      cancelAnimationFrame(busAnimId);
      busAnimId = null;
    }
    if (!els.vehicleBus || !els.activePath || !pathD || !els.activePath.getTotalLength) {
      if (els.vehicleBus) els.vehicleBus.style.opacity = "0";
      return;
    }
    els.vehicleBus.style.opacity = "1";
    const total = els.activePath.getTotalLength();
    if (!total) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const mid = els.activePath.getPointAtLength(total * 0.5);
      els.vehicleBus.setAttribute("transform", "translate(" + mid.x + ", " + mid.y + ")");
      return;
    }

    const duration = 5200;
    let startTs = null;
    const step = (ts) => {
      if (!startTs) startTs = ts;
      const t = ((ts - startTs) % duration) / duration;
      const dist = t * total;
      const pt = els.activePath.getPointAtLength(dist);
      const ahead = els.activePath.getPointAtLength(Math.min(total, dist + 4));
      const angle = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
      // Keep bus upright if moving right-to-left (return leg)
      const flip = Math.abs(angle) > 90 ? " scale(1, -1)" : "";
      els.vehicleBus.setAttribute(
        "transform",
        "translate(" + pt.x.toFixed(1) + ", " + pt.y.toFixed(1) + ") rotate(" + angle.toFixed(1) + ")" + flip
      );
      busAnimId = requestAnimationFrame(step);
    };
    busAnimId = requestAnimationFrame(step);
  }

  function renderMarkers() {
    if (!els.pinsLayer) return;

    const activeVenue = selectedLocationId ? VENUES[selectedLocationId] : null;
    if (els.activeHalo && activeVenue) {
      els.activeHalo.style.opacity = "1";
      els.activeHalo.style.transform = "translate(" + activeVenue.x + "px, " + activeVenue.y + "px)";
    } else if (els.activeHalo) {
      els.activeHalo.style.opacity = "0";
    }

    els.pinsLayer.innerHTML = "";
    const svgNs = "http://www.w3.org/2000/svg";

    locationGroups.forEach((grp) => {
      const v = grp.venue;
      const isSelected = v.id === selectedLocationId;

      const g = document.createElementNS(svgNs, "g");
      g.setAttribute(
        "class",
        "map-pin" + (isSelected ? " is-active" : "") + (!v.confirmed ? " is-unconfirmed" : "")
      );
      g.setAttribute("transform", "translate(" + v.x + ", " + v.y + ")");
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", v.name + " (" + grp.items.length + " agenda)");

      const hit = document.createElementNS(svgNs, "circle");
      hit.setAttribute("cy", "-16");
      hit.setAttribute("r", "24");
      hit.setAttribute("fill", "transparent");

      // Clean Teardrop Map Pin Icon (anchored at tip 0,0 so it never covers labels)
      const pinBody = document.createElementNS(svgNs, "path");
      pinBody.setAttribute("d", "M 0 0 C -7 -9 -11 -15 -11 -21 A 11 11 0 1 1 11 -21 C 11 -15 7 -9 0 0 Z");
      pinBody.setAttribute("fill", v.color);
      pinBody.setAttribute("class", "map-pin-circle");
      if (!v.confirmed) {
        pinBody.setAttribute("stroke-dasharray", "3 2");
      }

      const pinDot = document.createElementNS(svgNs, "circle");
      pinDot.setAttribute("cx", "0");
      pinDot.setAttribute("cy", "-21");
      pinDot.setAttribute("r", "4.2");
      pinDot.setAttribute("fill", "#FFFFFF");
      pinDot.setAttribute("pointer-events", "none");

      // Compact tooltip (only visible on hover or active pin)
      const tooltip = document.createElementNS(svgNs, "g");
      tooltip.setAttribute("class", "map-pin-tooltip");
      const labelText = v.name + (grp.items.length > 1 ? " · " + grp.items.length + " agenda" : "");
      const labelWidth = Math.max(84, labelText.length * 5.6 + 16);

      const labelBg = document.createElementNS(svgNs, "rect");
      labelBg.setAttribute("x", String(-labelWidth / 2));
      labelBg.setAttribute("y", "-54");
      labelBg.setAttribute("width", String(labelWidth));
      labelBg.setAttribute("height", "18");
      labelBg.setAttribute("rx", "6");
      labelBg.setAttribute("class", "map-pin-label-bg");

      const labelTxt = document.createElementNS(svgNs, "text");
      labelTxt.setAttribute("y", "-42");
      labelTxt.setAttribute("text-anchor", "middle");
      labelTxt.setAttribute("class", "map-pin-label");
      labelTxt.textContent = labelText;

      tooltip.appendChild(labelBg);
      tooltip.appendChild(labelTxt);

      g.appendChild(hit);
      g.appendChild(pinBody);
      g.appendChild(pinDot);
      g.appendChild(tooltip);

      const onSelectMarker = () => selectLocationMarker(v.id);
      g.addEventListener("click", onSelectMarker);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectMarker();
        }
      });

      els.pinsLayer.appendChild(g);
    });

    const selectedIdx = visibleItems.findIndex((i) => i.id === selectedId);
    if (els.stepCounter) {
      els.stepCounter.textContent = visibleItems.length
        ? "Pos " + (selectedIdx + 1) + " / " + visibleItems.length
        : "0 Pos";
    }
    if (els.prevBtn) els.prevBtn.disabled = selectedIdx <= 0;
    if (els.nextBtn) els.nextBtn.disabled = selectedIdx < 0 || selectedIdx >= visibleItems.length - 1;
  }

  function selectLocationMarker(locId) {
    selectedLocationId = locId;
    const grp = locationGroups.find((g) => g.venue.id === locId);
    if (grp && grp.items.length) {
      if (!grp.items.some((i) => i.id === selectedId)) {
        selectedId = grp.items[0].id;
      }
    }
    panelDayFilter = activeDay !== "ALL" ? activeDay : "ALL";
    renderAll();
    renderLocationPanel(locId);
    zoomToVenue(VENUES[locId]);
  }

  function renderLocationPanel(locId) {
    if (!els.ldp) return;
    const grp = locationGroups.find((g) => g.venue.id === locId);
    if (!grp) {
      els.ldp.hidden = true;
      return;
    }

    const v = grp.venue;
    els.ldp.hidden = false;
    if (els.resetZoomBtn) els.resetZoomBtn.hidden = false;

    if (els.ldpTitle) els.ldpTitle.textContent = v.name;
    if (els.ldpType) els.ldpType.textContent = v.typeLabel;
    if (els.ldpStatus) {
      if (!v.confirmed && v.statusText) {
        els.ldpStatus.textContent = v.statusText;
        els.ldpStatus.hidden = false;
      } else {
        els.ldpStatus.hidden = true;
      }
    }

    const days = Array.from(grp.days);
    if (els.ldpDayTabs) {
      if (days.length > 1) {
        els.ldpDayTabs.hidden = false;
        const tabOptions = ["ALL"].concat(days);
        els.ldpDayTabs.innerHTML = tabOptions
          .map((d) => {
            const label = d === "ALL" ? "Semua Hari" : d;
            const active = panelDayFilter === d ? " is-active" : "";
            return '<button type="button" class="ldp-day-btn' + active + '" data-ldp-day="' + escapeHtml(d) + '">' + escapeHtml(label) + "</button>";
          })
          .join("");
        els.ldpDayTabs.querySelectorAll("[data-ldp-day]").forEach((btn) => {
          btn.addEventListener("click", () => {
            panelDayFilter = btn.getAttribute("data-ldp-day");
            renderLocationPanel(locId);
          });
        });
      } else {
        els.ldpDayTabs.hidden = true;
        panelDayFilter = "ALL";
      }
    }

    if (els.ldpList) {
      const itemsToShow = panelDayFilter === "ALL"
        ? grp.items
        : grp.items.filter((i) => i.hari === panelDayFilter);

      els.ldpList.innerHTML = itemsToShow
        .map((item) => {
          const activeClass = item.id === selectedId ? " is-active" : "";
          return (
            '<li><button type="button" class="ldp-act-btn' + activeClass + '" data-ldp-item="' + escapeHtml(item.id) + '">' +
              '<span class="ldp-act-meta">' + escapeHtml(item.hari) + " · " + escapeHtml(item.waktu) + "</span>" +
              '<strong>' + escapeHtml(item.judul) + "</strong>" +
            "</button></li>"
          );
        })
        .join("");

      els.ldpList.querySelectorAll("[data-ldp-item]").forEach((btn) => {
        btn.addEventListener("click", () => {
          selectStop(btn.getAttribute("data-ldp-item"), true);
        });
      });
    }
  }

  function closeLocationPanel(resetCamera) {
    if (els.ldp) els.ldp.hidden = true;
    if (els.resetZoomBtn) els.resetZoomBtn.hidden = true;
    if (resetCamera) animateCameraTo(OVERVIEW_VIEWBOX, 800);
  }

  function zoomToVenue(venue) {
    if (!venue) return;
    const w = 480;
    const h = 272;
    const x = Math.max(0, Math.min(920 - w, venue.x - w / 2));
    const y = Math.max(0, Math.min(520 - h, venue.y - h / 2));
    animateCameraTo({ x, y, w, h }, 800);
  }

  function focusDayCamera() {
    if (activeDay === "ALL" || !locationGroups.length) {
      closeLocationPanel(false);
      animateCameraTo(OVERVIEW_VIEWBOX, 800);
      return;
    }
    const xs = locationGroups.map((g) => g.venue.x);
    const ys = locationGroups.map((g) => g.venue.y);
    const minX = Math.max(0, Math.min(...xs) - 140);
    const maxX = Math.min(920, Math.max(...xs) + 140);
    const minY = Math.max(0, Math.min(...ys) - 110);
    const maxY = Math.min(520, Math.max(...ys) + 110);
    let w = Math.max(460, maxX - minX);
    let h = (w * 520) / 920;
    if (minY + h < maxY) {
      h = Math.max(260, maxY - minY);
      w = (h * 920) / 520;
    }
    const x = Math.max(0, Math.min(920 - w, (minX + maxX) / 2 - w / 2));
    const y = Math.max(0, Math.min(520 - h, (minY + maxY) / 2 - h / 2));
    animateCameraTo({ x, y, w, h }, 800);
    if (els.resetZoomBtn) els.resetZoomBtn.hidden = false;
  }

  function animateCameraTo(target, duration) {
    if (!els.svg) return;
    if (cameraAnimId) {
      cancelAnimationFrame(cameraAnimId);
      cameraAnimId = null;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      currentViewBox = { ...target };
      els.svg.setAttribute("viewBox", `${target.x} ${target.y} ${target.w} ${target.h}`);
      return;
    }
    const start = { ...currentViewBox };
    let startTs = null;
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const frame = (ts) => {
      if (!startTs) startTs = ts;
      const raw = Math.min(1, (ts - startTs) / duration);
      const t = easeInOut(raw);
      currentViewBox = {
        x: start.x + (target.x - start.x) * t,
        y: start.y + (target.y - start.y) * t,
        w: start.w + (target.w - start.w) * t,
        h: start.h + (target.h - start.h) * t
      };
      els.svg.setAttribute(
        "viewBox",
        `${currentViewBox.x.toFixed(1)} ${currentViewBox.y.toFixed(1)} ${currentViewBox.w.toFixed(1)} ${currentViewBox.h.toFixed(1)}`
      );
      if (raw < 1) cameraAnimId = requestAnimationFrame(frame);
      else cameraAnimId = null;
    };
    cameraAnimId = requestAnimationFrame(frame);
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
        "<div>" +
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
    const item = visibleItems.find((i) => i.id === id);
    if (item) {
      selectedLocationId = resolveLocationId(item);
    }
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
