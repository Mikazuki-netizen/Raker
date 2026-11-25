/**
 * Main Application Orchestrator — Raker 2026
 */
(function () {
  const MODAL_CLOSE_MS = 190;
  let activeModalId = null;

  const dom = {
    refreshBtn: document.getElementById("btn-refresh-data"),
    openSheetBtn: document.getElementById("btn-open-sheet-modal"),
    footerSheetBtn: document.getElementById("btn-footer-sheet"),
    syncDot: document.getElementById("sync-dot"),
    syncLabel: document.getElementById("sync-label"),
    heroSyncNote: document.getElementById("hero-sync-note"),
    rundownSourceTag: document.getElementById("rundown-source-tag"),
    pesertaSourceTag: document.getElementById("peserta-source-tag"),
    statSessions: document.getElementById("stat-total-sessions"),
    statParticipants: document.getElementById("stat-total-participants"),
    modalSyncStatus: document.getElementById("modal-sync-status"),
    sheetForm: document.getElementById("sheet-config-form"),
    inputSheetUrl: document.getElementById("input-sheet-url"),
    inputRundownTab: document.getElementById("input-rundown-tab"),
    inputPesertaTab: document.getElementById("input-peserta-tab"),
    inputRundownCsv: document.getElementById("input-rundown-csv"),
    inputPesertaCsv: document.getElementById("input-peserta-csv"),
    resetDemoBtn: document.getElementById("btn-reset-demo"),
    toastContainer: document.getElementById("toast-container")
  };

  async function bootstrap() {
    window.RakerFieldMap.init(window.RAKER_DEFAULT_DATA.rundown);
    window.RakerParticipants.init(window.RAKER_DEFAULT_DATA.peserta, openParticipantModal);

    bindGlobalInteractions();
    populateSheetFormFromSettings();
    await syncSpreadsheetData(false);
  }

  function bindGlobalInteractions() {
    // Dress Code jump-to-route buttons (stop propagation so card preview doesn't open)
    document.querySelectorAll("[data-jump-day]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const day = btn.getAttribute("data-jump-day");
        window.RakerFieldMap.selectDay(day);
        const mapSection = document.getElementById("peta-rute");
        if (mapSection) {
          mapSection.scrollIntoView({ behavior: getScrollBehavior() });
        }
      });
    });

    // Dress Code Lookbook Preview Cards
    document.querySelectorAll("[data-preview-day]").forEach((card) => {
      const openPreview = () => {
        const dayNum = Number(card.getAttribute("data-preview-day")) || 1;
        openDressCodeModal(dayNum);
      };
      card.addEventListener("click", openPreview);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPreview();
        }
      });
    });

    document.querySelectorAll("[data-dc-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const dayNum = Number(tab.getAttribute("data-dc-tab")) || 1;
        renderDressCodeModalContent(dayNum);
      });
    });

    document.querySelectorAll("[data-dc-variant]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeDay2Variant = btn.getAttribute("data-dc-variant") || "karyawan";
        renderDressCodeModalContent(2);
      });
    });

    const dcJumpBtn = document.getElementById("dc-modal-jump-route");
    if (dcJumpBtn) {
      dcJumpBtn.addEventListener("click", () => {
        const day = dcJumpBtn.getAttribute("data-target-day") || "Day 1";
        closeModal("dresscode-modal");
        window.RakerFieldMap.selectDay(day);
        const mapSection = document.getElementById("peta-rute");
        if (mapSection) {
          mapSection.scrollIntoView({ behavior: getScrollBehavior() });
        }
      });
    }

    // Refresh data button
    if (dom.refreshBtn) {
      dom.refreshBtn.addEventListener("click", () => syncSpreadsheetData(true));
    }

    // Open Spreadsheet Connector modal (always lock with password 5555)
    if (dom.openSheetBtn) {
      dom.openSheetBtn.addEventListener("click", () => {
        const lockForm = document.getElementById("sheet-lock-form");
        const settingsView = document.getElementById("sheet-settings-view");
        const pwdInput = document.getElementById("input-sheet-password");
        const lockErr = document.getElementById("sheet-lock-error");
        if (lockForm) lockForm.hidden = false;
        if (settingsView) settingsView.hidden = true;
        if (pwdInput) pwdInput.value = "";
        if (lockErr) lockErr.hidden = true;
        openModal("spreadsheet-modal");
        if (pwdInput) setTimeout(() => pwdInput.focus(), 60);
      });
    }

    const lockForm = document.getElementById("sheet-lock-form");
    if (lockForm) {
      lockForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const pwdInput = document.getElementById("input-sheet-password");
        const lockErr = document.getElementById("sheet-lock-error");
        const settingsView = document.getElementById("sheet-settings-view");
        if (pwdInput && pwdInput.value === "5555") {
          lockForm.hidden = true;
          if (settingsView) settingsView.hidden = false;
          if (lockErr) lockErr.hidden = true;
        } else {
          if (lockErr) lockErr.hidden = false;
          if (pwdInput) {
            pwdInput.value = "";
            pwdInput.focus();
          }
        }
      });
    }

    // Close modal buttons & backdrop clicks
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.getAttribute("data-close-modal")));
    });

    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeModal(backdrop.id);
      });
    });

    // Keyboard shortcuts: Esc closes modal, Left/Right arrows step route
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && activeModalId) {
        closeModal(activeModalId);
        return;
      }
      if (activeModalId) return;
      const tag = document.activeElement ? document.activeElement.tagName : "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") window.RakerFieldMap.stepBy(-1);
      if (e.key === "ArrowRight") window.RakerFieldMap.stepBy(1);
    });

    // Spreadsheet form submit
    if (dom.sheetForm) {
      dom.sheetForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nextSettings = {
          spreadsheetUrl: dom.inputSheetUrl.value.trim(),
          rundownSheetName: dom.inputRundownTab.value.trim() || "Rundown",
          pesertaSheetName: dom.inputPesertaTab.value.trim() || "Peserta",
          rundownCsvUrl: dom.inputRundownCsv.value.trim(),
          pesertaCsvUrl: dom.inputPesertaCsv.value.trim(),
          appsScriptUrl: (window.RAKER_CONFIG && window.RAKER_CONFIG.appsScriptUrl) || ""
        };
        window.RakerSheets.saveSettings(nextSettings);
        const ok = await syncSpreadsheetData(true);
        if (ok) closeModal("spreadsheet-modal");
      });
    }

    // Reset to Demo Mode
    if (dom.resetDemoBtn) {
      dom.resetDemoBtn.addEventListener("click", async () => {
        window.RakerSheets.clearSavedSettings();
        populateSheetFormFromSettings();
        await syncSpreadsheetData(true);
        closeModal("spreadsheet-modal");
      });
    }

    // Scroll-spy for sticky navigation links
    setupScrollSpy();
    setupStopmapTabs();
    setupDressCodeDeck();
    setupStickyScrollNav();
  }

  function setupStickyScrollNav() {
    const header = document.getElementById("site-header");
    if (!header) return;
    const onScroll = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 30);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  let currentDeckDay = 1;

  window.selectDressCodeDeck = function (activeDayNum) {
    const cards = Array.from(document.querySelectorAll("#dresscode-grid .dresscode-card"));
    const indicator = document.getElementById("dc-deck-indicator");
    if (!cards.length) return;

    currentDeckDay = ((activeDayNum - 1 + cards.length) % cards.length) + 1;
    if (indicator) indicator.textContent = currentDeckDay + " / " + cards.length;

    cards.forEach((card, idx) => {
      const dayNum = Number(card.getAttribute("data-preview-day")) || (idx + 1);
      card.classList.remove("is-deck-front", "is-deck-mid", "is-deck-back");
      const offset = (dayNum - currentDeckDay + cards.length) % cards.length;
      if (offset === 0) card.classList.add("is-deck-front");
      else if (offset === 1) card.classList.add("is-deck-mid");
      else card.classList.add("is-deck-back");
    });
  };

  window.stepDressCodeDeck = function (delta) {
    window.selectDressCodeDeck(currentDeckDay + delta);
  };

  function setupDressCodeDeck() {
    window.selectDressCodeDeck(1);
  }

  function populateSheetFormFromSettings() {
    const s = window.RakerSheets.getSettings();
    if (dom.inputSheetUrl) dom.inputSheetUrl.value = s.spreadsheetUrl || "";
    if (dom.inputRundownTab) dom.inputRundownTab.value = s.rundownSheetName || "Rundown";
    if (dom.inputPesertaTab) dom.inputPesertaTab.value = s.pesertaSheetName || "Peserta";
    if (dom.inputRundownCsv) dom.inputRundownCsv.value = s.rundownCsvUrl || "";
    if (dom.inputPesertaCsv) dom.inputPesertaCsv.value = s.pesertaCsvUrl || "";
  }

  async function syncSpreadsheetData(showFeedback) {
    if (dom.refreshBtn) dom.refreshBtn.classList.add("is-loading");

    try {
      const data = await window.RakerSheets.loadAllData();
      window.RakerFieldMap.setData(data.rundown);
      window.RakerParticipants.setData(data.peserta);

      if (dom.statSessions) dom.statSessions.textContent = String(data.rundown.length);
      if (dom.statParticipants) dom.statParticipants.textContent = String(data.peserta.length);

      const isLive = data.mode === "live";
      if (dom.syncDot) {
        dom.syncDot.classList.toggle("is-live", isLive);
        dom.syncDot.classList.remove("is-error");
      }
      if (dom.syncLabel) dom.syncLabel.textContent = isLive ? "Google Sheets Live" : "Mode Demo";
      if (dom.rundownSourceTag) dom.rundownSourceTag.textContent = "Sumber: " + data.sourceLabel;
      if (dom.pesertaSourceTag) dom.pesertaSourceTag.textContent = "Sumber: " + data.sourceLabel;

      const timeStr = data.syncedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      if (dom.heroSyncNote) {
        dom.heroSyncNote.textContent = isLive
          ? "Live Google Sheets · Sinkron pukul " + timeStr
          : "Mode Demo · Hubungkan Google Sheet di kanan atas";
      }
      if (dom.modalSyncStatus) {
        dom.modalSyncStatus.textContent = isLive
          ? "Terhubung ke Google Sheets (" + data.rundown.length + " rundown, " + data.peserta.length + " peserta)."
          : "Menggunakan data template bawaan (Demo Mode).";
      }

      if (showFeedback) {
        showToast(
          isLive
            ? "Data berhasil disinkronkan dari Google Spreadsheet."
            : "Menampilkan data template bawaan (Mode Demo)."
        );
      }
      return true;
    } catch (err) {
      if (dom.syncDot) {
        dom.syncDot.classList.remove("is-live");
        dom.syncDot.classList.add("is-error");
      }
      if (dom.syncLabel) dom.syncLabel.textContent = "Gagal Sinkron";
      if (dom.modalSyncStatus) {
        dom.modalSyncStatus.textContent = "Error: " + (err && err.message ? err.message : "Gagal membaca spreadsheet.");
      }
      if (showFeedback) {
        showToast(err && err.message ? err.message : "Gagal memuat data spreadsheet.", true);
      }
      return false;
    } finally {
      if (dom.refreshBtn) dom.refreshBtn.classList.remove("is-loading");
    }
  }

  let activeDay2Variant = "karyawan";

  function openDressCodeModal(dayNum) {
    renderDressCodeModalContent(dayNum);
    openModal("dresscode-modal");
  }

  function renderDressCodeModalContent(dayNum) {
    const list = (window.RAKER_CONFIG && window.RAKER_CONFIG.event && window.RAKER_CONFIG.event.dressCodes) || [];
    const item = list.find((d) => d.day === dayNum) || list[0];
    if (!item) return;

    const kicker = document.getElementById("dc-modal-kicker");
    const title = document.getElementById("dc-modal-title");
    const date = document.getElementById("dc-modal-date");
    const desc = document.getElementById("dc-modal-desc");
    const img = document.getElementById("dc-modal-img");
    const jumpBtn = document.getElementById("dc-modal-jump-route");
    const variantTabs = document.getElementById("dc-variant-tabs");

    const isDay2 = item.day === 2;
    if (variantTabs) variantTabs.hidden = !isDay2;

    if (kicker) kicker.textContent = "Lookbook Referensi · " + item.label;
    if (date) date.textContent = item.date;

    if (isDay2) {
      const isLeader = activeDay2Variant === "leader";
      if (title) title.textContent = isLeader ? "Seragam Leader (Cewe & Cowo)" : "Seragam Karyawan (Cewe & Cowo)";
      if (desc) {
        desc.textContent = isLeader
          ? "Kemeja formal maroon lengan panjang dengan bordir merah SIBA SURYA & celana hitam."
          : "Kemeja PDH maroon lengan pendek dua saku depan & celana cargo hitam.";
      }
      if (img) {
        img.src = isLeader ? "assets/dresscode-day2-leader.jpg" : "assets/dresscode-day2-karyawan.jpg";
        img.alt = isLeader
          ? "Preview model cewe dan cowo mengenakan Seragam Leader"
          : "Preview model cewe dan cowo mengenakan Seragam Karyawan";
      }
      document.querySelectorAll("[data-dc-variant]").forEach((btn) => {
        btn.classList.toggle("is-active", btn.getAttribute("data-dc-variant") === activeDay2Variant);
      });
    } else {
      if (title) title.textContent = item.attire;
      if (desc) desc.textContent = item.notes;
      if (img) {
        img.src = "assets/dresscode-day" + item.day + ".jpg";
        img.alt = "Preview model pria dan wanita mengenakan " + item.attire;
      }
    }

    if (jumpBtn) {
      jumpBtn.setAttribute("data-target-day", "Day " + item.day);
    }

    document.querySelectorAll("[data-dc-tab]").forEach((tab) => {
      tab.classList.toggle("is-active", Number(tab.getAttribute("data-dc-tab")) === item.day);
    });
  }

  function openParticipantModal(p) {
    const avatar = document.getElementById("pm-avatar");
    const name = document.getElementById("pm-name");
    const role = document.getElementById("pm-role");
    const grid = document.getElementById("pm-detail-grid");

    if (avatar) avatar.textContent = window.RakerParticipants.getInitials(p.nama);
    if (name) name.textContent = p.nama;
    if (role) role.textContent = p.jabatan + " · " + p.divisi;

    if (grid) {
      grid.innerHTML =
        detailField("No. Urut", "#" + escapeHtml(p.no)) +
        detailField("Status Kehadiran", escapeHtml(p.status)) +
        detailField("Transport / Bus", escapeHtml(p.kelompok_transport)) +
        detailField("No. Kamar De Djokja", escapeHtml(p.no_kamar)) +
        detailField("Kontak / WhatsApp", escapeHtml(p.kontak)) +
        detailField("Ukuran Seragam", escapeHtml(p.ukuran_seragam)) +
        '<div class="pm-field is-full"><span>Catatan Khusus</span><strong>' + escapeHtml(p.catatan || "-") + "</strong></div>";
    }

    openModal("participant-modal");
  }

  function detailField(label, value) {
    return '<div class="pm-field"><span>' + label + "</span><strong>" + value + "</strong></div>";
  }

  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    activeModalId = id;
    el.hidden = false;
    el.classList.remove("is-closing");
    requestAnimationFrame(() => {
      el.classList.add("is-open");
    });
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el || el.hidden) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.classList.remove("is-open");
    if (reduced) {
      el.hidden = true;
      if (activeModalId === id) activeModalId = null;
      return;
    }
    el.classList.add("is-closing");
    setTimeout(() => {
      el.hidden = true;
      el.classList.remove("is-closing");
      if (activeModalId === id) activeModalId = null;
    }, MODAL_CLOSE_MS);
  }

  function showToast(message, isError) {
    if (!dom.toastContainer) return;
    const toast = document.createElement("div");
    toast.className = "toast" + (isError ? " is-error" : "");
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    setTimeout(() => {
      toast.classList.remove("is-visible");
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 220);
    }, 3400);
  }

  function setupScrollSpy() {
    const sections = ["undangan", "peta-rute", "peserta"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    const navLinks = document.querySelectorAll("[data-nav]");
    if (!sections.length || !navLinks.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          navLinks.forEach((link) => {
            link.classList.toggle("is-active", link.getAttribute("data-nav") === id);
          });
        });
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );

    sections.forEach((sec) => observer.observe(sec));
  }

  function getScrollBehavior() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
