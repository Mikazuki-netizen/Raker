/**
 * Main Application Orchestrator — Raker 2027
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

    setupOpeningCurtain();
    setupMemoriesGallery();
    bindGlobalInteractions();
    populateSheetFormFromSettings();
    setupScrollMotion();
    await syncSpreadsheetData(false);
    setupAutoSync();
  }

  let lastSyncAt = 0;

  function setupAutoSync() {
    lastSyncAt = Date.now();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && Date.now() - lastSyncAt > 15000) {
        lastSyncAt = Date.now();
        syncSpreadsheetData(false);
      }
    });
    setInterval(() => {
      if (document.visibilityState === "visible") {
        lastSyncAt = Date.now();
        syncSpreadsheetData(false);
      }
    }, 60000);
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

    // Open Hotel Polaroid Preview Modal
    const polaroidTrigger = document.getElementById("polaroid-hotel-trigger");
    if (polaroidTrigger) {
      polaroidTrigger.addEventListener("click", () => {
        openModal("hotel-photo-modal");
      });
      polaroidTrigger.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal("hotel-photo-modal");
        }
      });
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

    let unlockedSheetPassword = "";
    const lockForm = document.getElementById("sheet-lock-form");
    if (lockForm) {
      lockForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const pwdInput = document.getElementById("input-sheet-password");
        const lockErr = document.getElementById("sheet-lock-error");
        const settingsView = document.getElementById("sheet-settings-view");
        if (pwdInput && pwdInput.value === "5555") {
          unlockedSheetPassword = pwdInput.value;
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
          rundownSheetName: dom.inputRundownTab.value.trim() || "rundown",
          pesertaSheetName: dom.inputPesertaTab.value.trim() || "peserta",
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
      if (data.activeSettings) {
        if (dom.inputSheetUrl) dom.inputSheetUrl.value = data.activeSettings.spreadsheetUrl || "";
        if (dom.inputRundownTab) dom.inputRundownTab.value = data.activeSettings.rundownSheetName || "rundown";
        if (dom.inputPesertaTab) dom.inputPesertaTab.value = data.activeSettings.pesertaSheetName || "peserta";
      }

      if (dom.statSessions) dom.statSessions.textContent = String(data.rundown.length);
      if (dom.statParticipants) dom.statParticipants.textContent = String(data.peserta.length);

      const isLive = data.mode === "live";
      if (dom.syncDot) {
        dom.syncDot.classList.toggle("is-live", isLive);
        dom.syncDot.classList.remove("is-error");
      }
      if (dom.syncLabel) dom.syncLabel.textContent = isLive ? "Google Sheets Live" : "Mode Demo";

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
        detailField("NIP", escapeHtml(p.nip || "-")) +
        detailField("Kantor", escapeHtml(p.kantor || p.kelompok_transport || "-")) +
        detailField("Departemen", escapeHtml(p.divisi || "-")) +
        detailField("Job Position", escapeHtml(p.jabatan || "-")) +
        detailField("Gender", escapeHtml(p.gender || "-")) +
        '<div class="pm-field is-full"><span>Peran</span><strong>' + escapeHtml(p.peran || p.status || "Peserta") + "</strong></div>";
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

  function setupOpeningCurtain() {
    const curtain = document.getElementById("opening-curtain");
    if (!curtain) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      curtain.classList.add("is-done");
      return;
    }
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      curtain.classList.add("is-opening");
      setTimeout(() => {
        curtain.classList.add("is-done");
      }, 900);
    };
    curtain.addEventListener("click", dismiss, { once: true });
    setTimeout(dismiss, 2000);
  }

  let activeMemoryIdx = 0;

  function setupMemoriesGallery() {
    const track = document.getElementById("memories-track");
    const memories = (window.RAKER_CONFIG && window.RAKER_CONFIG.event && window.RAKER_CONFIG.event.memories) || [];
    if (!track || !memories.length) return;

    track.innerHTML = memories
      .map((item, idx) => {
        const dur = (4.6 + (idx % 3) * 0.8).toFixed(1) + "s";
        const delay = (-1.1 * idx).toFixed(1) + "s";
        const mediaHtml = item.image
          ? '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.caption || item.location) + '" loading="lazy" />'
          : '<div class="memory-placeholder-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Slot Foto</span></div>';

        return (
          '<button type="button" class="memory-polaroid" role="listitem" data-memory-idx="' + idx + '" ' +
          'style="--sway-dur:' + dur + ';--sway-delay:' + delay + ';" aria-label="Lihat ' + escapeHtml(item.location || "Memori Raker") + '">' +
          '<span class="memory-clip" aria-hidden="true"></span>' +
          '<div class="memory-photo-box">' + mediaHtml + '</div>' +
          '<div class="memory-caption-bar">' +
          '<span class="memory-year-tag">' + escapeHtml(item.year || "Arsip") + '</span>' +
          '<span class="memory-loc-tag">' + escapeHtml(item.location || "") + '</span>' +
          '</div>' +
          '</button>'
        );
      })
      .join("");

    track.addEventListener("click", (e) => {
      const card = e.target.closest("[data-memory-idx]");
      if (!card) return;
      openMemoryLightbox(Number(card.getAttribute("data-memory-idx")) || 0);
    });

    // Horizontal drag-to-scroll on clothesline
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    track.addEventListener("mousedown", (e) => {
      isDown = true;
      startX = e.pageX - track.offsetLeft;
      scrollLeft = track.scrollLeft;
    });
    window.addEventListener("mouseup", () => { isDown = false; });
    track.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - track.offsetLeft;
      track.scrollLeft = scrollLeft - (x - startX);
    });

    const prevBtn = document.getElementById("ml-prev");
    const nextBtn = document.getElementById("ml-next");
    if (prevBtn) prevBtn.addEventListener("click", () => stepMemoryLightbox(-1));
    if (nextBtn) nextBtn.addEventListener("click", () => stepMemoryLightbox(1));
  }

  function openMemoryLightbox(idx) {
    renderMemoryLightbox(idx);
    openModal("memory-lightbox-modal");
  }

  function stepMemoryLightbox(delta) {
    const memories = (window.RAKER_CONFIG && window.RAKER_CONFIG.event && window.RAKER_CONFIG.event.memories) || [];
    if (!memories.length) return;
    renderMemoryLightbox((activeMemoryIdx + delta + memories.length) % memories.length);
  }

  function renderMemoryLightbox(idx) {
    const memories = (window.RAKER_CONFIG && window.RAKER_CONFIG.event && window.RAKER_CONFIG.event.memories) || [];
    if (!memories.length) return;
    activeMemoryIdx = ((idx % memories.length) + memories.length) % memories.length;
    const item = memories[activeMemoryIdx];

    const kicker = document.getElementById("ml-kicker");
    const title = document.getElementById("ml-title");
    const img = document.getElementById("ml-img");
    const empty = document.getElementById("ml-empty");
    const year = document.getElementById("ml-year");
    const caption = document.getElementById("ml-caption");
    const counter = document.getElementById("ml-counter");

    if (kicker) kicker.textContent = "Raker Memories · " + (item.year || "Arsip");
    if (title) title.textContent = item.location || "Dokumentasi Raker";
    if (year) year.textContent = (item.year || "Arsip") + " · " + (item.location || "");
    if (caption) caption.textContent = item.caption || "";
    if (counter) counter.textContent = (activeMemoryIdx + 1) + " / " + memories.length;

    if (item.image && img && empty) {
      img.src = item.image;
      img.alt = item.caption || item.location || "Dokumentasi Raker";
      img.hidden = false;
      empty.hidden = true;
    } else if (img && empty) {
      img.hidden = true;
      empty.hidden = false;
    }
  }

  function setupScrollMotion() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealEls = document.querySelectorAll(".reveal-on-scroll");

    if (reduced || !("IntersectionObserver" in window)) {
      revealEls.forEach((el) => el.classList.add("is-revealed"));
    } else if (revealEls.length) {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-revealed");
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.14 }
      );
      revealEls.forEach((el) => obs.observe(el));
    }
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
