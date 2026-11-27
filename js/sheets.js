/**
 * Konektor Database Google Spreadsheet untuk Rundown & Daftar Peserta.
 * Mendukung:
 * 1. URL Google Spreadsheet utama (Anyone with the link -> Viewer) via endpoint gviz CSV
 * 2. URL CSV "Publish to web" per tab
 * 3. URL Apps Script Web App JSON
 * 4. Fallback otomatis ke RAKER_DEFAULT_DATA
 */
window.RakerSheets = (function () {
  const STORAGE_KEY = "raker2027_sheet_settings_v1";
  const DEFAULT_SHEET_URL =
    "https://docs.google.com/spreadsheets/d/1VHLK_qjf_-vnhYYwoq3Qavz6yHXZoIyNeIjdbUtZODs/edit?usp=sharing";

  function getSettings() {
    const base = window.RAKER_CONFIG || {};
    let saved = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (_) {
      saved = {};
    }

    return {
      spreadsheetUrl: saved.spreadsheetUrl || base.spreadsheetUrl || DEFAULT_SHEET_URL,
      rundownSheetName: saved.rundownSheetName || base.rundownSheetName || "rundown",
      pesertaSheetName: saved.pesertaSheetName || base.pesertaSheetName || "peserta",
      rundownCsvUrl: saved.rundownCsvUrl || base.rundownCsvUrl || "",
      pesertaCsvUrl: saved.pesertaCsvUrl || base.pesertaCsvUrl || "",
      appsScriptUrl: saved.appsScriptUrl || base.appsScriptUrl || ""
    };
  }

  function saveSettings(next) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (_) {
      // Ignore storage quota errors
    }
  }

  function clearSavedSettings() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {
      // Ignore
    }
  }

  function isConfigured(settings) {
    return Boolean(
      settings.appsScriptUrl ||
      settings.rundownCsvUrl ||
      settings.pesertaCsvUrl ||
      window.RakerCsv.extractSpreadsheetId(settings.spreadsheetUrl)
    );
  }

  function pick(obj, keys, fallback = "") {
    for (let i = 0; i < keys.length; i += 1) {
      const val = obj[keys[i]];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return String(val).trim();
      }
    }
    return fallback;
  }

  function normalizeRundownRow(raw, idx) {
    const hariRaw = pick(raw, ["hari", "day", "hari_ke"], "Day 1");
    const hari = /^[123]$/.test(hariRaw) ? "Day " + hariRaw : hariRaw;
    const faseRaw = pick(raw, ["fase", "phase", "kategori", "tahap"], "raker").toLowerCase();

    return {
      id: pick(raw, ["id", "no", "urutan"], String(idx + 1)),
      hari,
      tanggal: pick(raw, ["tanggal", "date", "tgl"], ""),
      waktu: pick(raw, ["waktu", "jam", "time", "pukul"], "-"),
      fase: normalizePhase(faseRaw),
      location_id: pick(raw, ["location_id", "lokasi_id", "venue_id"], ""),
      location_status: pick(raw, ["location_status", "status_lokasi"], ""),
      judul: pick(raw, ["judul", "agenda", "kegiatan", "acara", "title", "aktivitas"], "Agenda " + (idx + 1)),
      lokasi: pick(raw, ["lokasi", "tempat", "ruangan", "location", "venue"], "De Djokja Hotel"),
      pic: pick(raw, ["pic", "pembicara", "koordinator", "speaker", "penanggung_jawab"], "-"),
      dress_code: pick(raw, ["dress_code", "dresscode", "busana", "pakaian", "seragam"], "-"),
      keterangan: pick(raw, ["keterangan", "deskripsi", "catatan", "notes", "detail"], "-"),
      status: pick(raw, ["status", "state"], "Terjadwal"),
      koordinat_x: parseFloat(pick(raw, ["koordinat_x", "x"], "")) || null,
      koordinat_y: parseFloat(pick(raw, ["koordinat_y", "y"], "")) || null
    };
  }

  function normalizePhase(raw) {
    if (raw.includes("berangkat") || raw.includes("kumpul") || raw.includes("perjalanan")) return "berangkat";
    if (raw.includes("pulang") || raw.includes("kembali")) return "pulang";
    if (raw.includes("hotel") || raw.includes("check") || raw.includes("kamar")) return "hotel";
    if (raw.includes("budaya") || raw.includes("gala") || raw.includes("hiburan")) return "budaya";
    if (raw.includes("ishoma") || raw.includes("makan") || raw.includes("break")) return "ishoma";
    return "raker";
  }

  function normalizePesertaRow(raw, idx) {
    const kantor = pick(raw, ["kantor", "office", "cabang", "kelompok_transport", "transport", "bus"], "-");
    const departemen = pick(raw, ["departemen", "divisi", "unit", "unit_kerja", "department"], "-");
    const jabatan = pick(raw, ["job_position", "jabatan", "posisi", "role", "title"], "-");
    const nip = pick(raw, ["nip", "nik", "employee_id", "no_kamar", "kamar"], "-");
    const gender = pick(raw, ["gender", "jenis_kelamin", "kelamin"], "-");
    const peran = pick(raw, ["peran", "status", "kehadiran", "konfirmasi"], "Peserta");

    return {
      no: pick(raw, ["no", "id", "nomor", "urutan"], String(idx + 1)),
      nama: pick(raw, ["nama", "nama_peserta", "name", "full_name"], "Peserta " + (idx + 1)),
      nip: nip,
      kantor: kantor,
      jabatan: jabatan,
      divisi: departemen,
      gender: gender,
      peran: peran,
      kelompok_transport: pick(raw, ["kelompok_transport", "transport", "bus", "kelompok", "armada"], kantor),
      no_kamar: pick(raw, ["no_kamar", "kamar", "room", "room_no"], nip),
      kontak: pick(raw, ["kontak", "hp", "no_hp", "wa", "whatsapp", "telepon", "phone"], "-"),
      ukuran_seragam: pick(raw, ["ukuran_seragam", "ukuran", "size", "baju"], "-"),
      status: peran,
      catatan: pick(raw, ["catatan", "keterangan", "notes", "alergi"], "-")
    };
  }

  async function fetchCsvRows(url) {
    const separator = url.includes("?") ? "&" : "?";
    const bustUrl = url + separator + "_ts=" + Date.now();
    const res = await fetch(bustUrl);
    if (!res.ok) {
      throw new Error("HTTP " + res.status + " saat mengambil data spreadsheet.");
    }
    const text = await res.text();
    if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
      throw new Error("Google Sheet belum dibagikan publik ('Anyone with the link -> Viewer').");
    }
    return window.RakerCsv.parse(text);
  }

  async function fetchServerConfig() {
    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 4000) : null;
      const res = await fetch("/api/sheet-config?_ts=" + Date.now(), controller ? { signal: controller.signal } : undefined);
      if (timer) clearTimeout(timer);
      if (!res.ok) return null;
      const json = await res.json();
      if (json && json.ok && json.config && json.persistent) {
        return json.config;
      }
    } catch (_) {
      // Ignore when running on static local server without /api or on timeout
    }
    return null;
  }

  async function saveServerConfig(next, password) {
    try {
      const res = await fetch("/api/sheet-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: password || "",
          spreadsheetUrl: next.spreadsheetUrl,
          rundownSheetName: next.rundownSheetName,
          pesertaSheetName: next.pesertaSheetName,
          rundownCsvUrl: next.rundownCsvUrl,
          pesertaCsvUrl: next.pesertaCsvUrl
        })
      });
      if (!res.ok) return { ok: false, persistent: false };
      return await res.json();
    } catch (_) {
      return { ok: false, persistent: false };
    }
  }

  async function loadAllData() {
    let settings = getSettings();
    const serverConfig = await fetchServerConfig();
    if (serverConfig && serverConfig.spreadsheetUrl) {
      settings = {
        ...settings,
        spreadsheetUrl: serverConfig.spreadsheetUrl,
        rundownSheetName: serverConfig.rundownSheetName || settings.rundownSheetName,
        pesertaSheetName: serverConfig.pesertaSheetName || settings.pesertaSheetName,
        rundownCsvUrl: serverConfig.rundownCsvUrl ?? settings.rundownCsvUrl,
        pesertaCsvUrl: serverConfig.pesertaCsvUrl ?? settings.pesertaCsvUrl
      };
    }

    if (!isConfigured(settings)) {
      return {
        mode: "demo",
        sourceLabel: "Default Template (Demo)",
        rundown: window.RAKER_DEFAULT_DATA.rundown.slice(),
        peserta: window.RAKER_DEFAULT_DATA.peserta.slice(),
        syncedAt: new Date()
      };
    }

    // Mode Apps Script JSON
    if (settings.appsScriptUrl) {
      const res = await fetch(settings.appsScriptUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal memuat endpoint Apps Script (" + res.status + ").");
      const json = await res.json();
      const rundownRaw = Array.isArray(json.rundown) ? json.rundown : [];
      const pesertaRaw = Array.isArray(json.peserta) ? json.peserta : [];
      return {
        mode: "live",
        sourceLabel: "Google Sheets (Apps Script)",
        rundown: rundownRaw.map(normalizeRundownRow),
        peserta: pesertaRaw.map(normalizePesertaRow),
        syncedAt: new Date()
      };
    }

    const sheetId = window.RakerCsv.extractSpreadsheetId(settings.spreadsheetUrl);
    const rundownUrl =
      settings.rundownCsvUrl ||
      (sheetId ? window.RakerCsv.buildGvizCsvUrl(sheetId, settings.rundownSheetName) : "");
    const pesertaUrl =
      settings.pesertaCsvUrl ||
      (sheetId ? window.RakerCsv.buildGvizCsvUrl(sheetId, settings.pesertaSheetName) : "");

    const [rundownSet, pesertaSet] = await Promise.allSettled([
      rundownUrl ? fetchCsvRows(rundownUrl) : Promise.resolve(null),
      pesertaUrl ? fetchCsvRows(pesertaUrl) : Promise.resolve(null)
    ]);

    const rundownResult = rundownSet.status === "fulfilled" ? rundownSet.value : null;
    const pesertaResult = pesertaSet.status === "fulfilled" ? pesertaSet.value : null;

    if (rundownSet.status === "rejected" && pesertaSet.status === "rejected") {
      throw rundownSet.reason || pesertaSet.reason;
    }

    return {
      mode: "live",
      sourceLabel: "Google Sheets Live",
      activeSettings: settings,
      rundown: rundownResult && rundownResult.length ? rundownResult.map(normalizeRundownRow) : window.RAKER_DEFAULT_DATA.rundown.slice(),
      peserta: pesertaResult && pesertaResult.length ? pesertaResult.map(normalizePesertaRow) : window.RAKER_DEFAULT_DATA.peserta.slice(),
      syncedAt: new Date()
    };
  }

  return {
    getSettings,
    saveSettings,
    saveServerConfig,
    clearSavedSettings,
    isConfigured,
    loadAllData
  };
})();
