/**
 * Konektor Database Google Spreadsheet untuk Rundown & Daftar Peserta.
 * Mendukung:
 * 1. URL Google Spreadsheet utama (Anyone with the link -> Viewer) via endpoint gviz CSV
 * 2. URL CSV "Publish to web" per tab
 * 3. URL Apps Script Web App JSON
 * 4. Fallback otomatis ke RAKER_DEFAULT_DATA
 */
window.RakerSheets = (function () {
  const STORAGE_KEY = "raker2026_sheet_settings_v1";

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
      spreadsheetUrl: saved.spreadsheetUrl ?? base.spreadsheetUrl ?? "",
      rundownSheetName: saved.rundownSheetName || base.rundownSheetName || "Rundown",
      pesertaSheetName: saved.pesertaSheetName || base.pesertaSheetName || "Peserta",
      rundownCsvUrl: saved.rundownCsvUrl ?? base.rundownCsvUrl ?? "",
      pesertaCsvUrl: saved.pesertaCsvUrl ?? base.pesertaCsvUrl ?? "",
      appsScriptUrl: saved.appsScriptUrl ?? base.appsScriptUrl ?? ""
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
    return {
      no: pick(raw, ["no", "id", "nomor", "urutan"], String(idx + 1)),
      nama: pick(raw, ["nama", "nama_peserta", "name", "full_name"], "Peserta " + (idx + 1)),
      jabatan: pick(raw, ["jabatan", "posisi", "role", "title"], "-"),
      divisi: pick(raw, ["divisi", "unit", "departemen", "unit_kerja", "department"], "-"),
      kelompok_transport: pick(raw, ["kelompok_transport", "transport", "bus", "kelompok", "armada"], "-"),
      no_kamar: pick(raw, ["no_kamar", "kamar", "room", "room_no"], "-"),
      kontak: pick(raw, ["kontak", "hp", "no_hp", "wa", "whatsapp", "telepon", "phone"], "-"),
      ukuran_seragam: pick(raw, ["ukuran_seragam", "ukuran", "size", "baju"], "-"),
      status: pick(raw, ["status", "kehadiran", "konfirmasi"], "Terkonfirmasi"),
      catatan: pick(raw, ["catatan", "keterangan", "notes", "alergi"], "-")
    };
  }

  async function fetchCsvRows(url) {
    const separator = url.includes("?") ? "&" : "?";
    const bustUrl = url + separator + "_ts=" + Date.now();
    const res = await fetch(bustUrl, { cache: "no-store" });
    if (!res.ok) {
      throw new Error("HTTP " + res.status + " saat mengambil data spreadsheet.");
    }
    const text = await res.text();
    if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
      throw new Error("Google Sheet belum dibagikan publik ('Anyone with the link -> Viewer').");
    }
    return window.RakerCsv.parse(text);
  }

  async function loadAllData() {
    const settings = getSettings();

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

    const [rundownResult, pesertaResult] = await Promise.all([
      rundownUrl ? fetchCsvRows(rundownUrl) : Promise.resolve(null),
      pesertaUrl ? fetchCsvRows(pesertaUrl) : Promise.resolve(null)
    ]);

    return {
      mode: "live",
      sourceLabel: "Google Sheets Live",
      rundown: rundownResult && rundownResult.length ? rundownResult.map(normalizeRundownRow) : window.RAKER_DEFAULT_DATA.rundown.slice(),
      peserta: pesertaResult && pesertaResult.length ? pesertaResult.map(normalizePesertaRow) : window.RAKER_DEFAULT_DATA.peserta.slice(),
      syncedAt: new Date()
    };
  }

  return {
    getSettings,
    saveSettings,
    clearSavedSettings,
    isConfigured,
    loadAllData
  };
})();
