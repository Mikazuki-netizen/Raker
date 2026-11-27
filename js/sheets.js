/**
 * Konektor Database Google Spreadsheet untuk Rundown & Daftar Peserta.
 * Mendukung:
 * 1. JSONP langsung ke Google Sheets (Bypass browser CORS secara native tanpa server/proxy)
 * 2. Vercel Serverless Function Proxy (/api/sheets)
 * 3. Direct CSV fetch ("Publish to web" / gviz CSV)
 * 4. Google Apps Script Web App JSON
 * 5. Fallback otomatis ke RAKER_DEFAULT_DATA (93 Peserta & 13 Agenda Rundown)
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

    const spreadsheetUrl = saved.spreadsheetUrl || base.spreadsheetUrl || DEFAULT_SHEET_URL;

    return {
      spreadsheetUrl: spreadsheetUrl,
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
    if (!obj) return fallback;
    for (let i = 0; i < keys.length; i += 1) {
      const val = obj[keys[i]];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return String(val).trim();
      }
    }
    return fallback;
  }

  function formatSheetDate(val) {
    if (!val) return "";
    val = String(val).trim();
    if (val.startsWith("Date(") && val.endsWith(")")) {
      const parts = val.slice(5, -1).split(",").map(Number);
      if (parts.length >= 3) {
        const d = new Date(parts[0], parts[1], parts[2]);
        return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
      }
    }
    return val;
  }

  function normalizeRundownRow(raw, idx) {
    const hariRaw = pick(raw, ["hari", "day", "hari_ke"], "Day 1");
    const hari = /^[123]$/.test(hariRaw) ? "Day " + hariRaw : hariRaw;
    const faseRaw = pick(raw, ["fase", "phase", "kategori", "tahap"], "raker").toLowerCase();

    return {
      id: pick(raw, ["id", "no", "urutan"], String(idx + 1)),
      hari,
      tanggal: formatSheetDate(pick(raw, ["tanggal", "date", "tgl"], "")),
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
    const nama = pick(raw, ["nama", "nama_peserta", "name", "full_name"]);
    if (!nama) return null;

    const kantor = pick(raw, ["kantor", "office", "cabang", "kelompok_transport", "transport", "bus"], "-");
    const departemen = pick(raw, ["departemen", "divisi", "unit", "unit_kerja", "department"], "-");
    const jabatan = pick(raw, ["job_position", "jabatan", "posisi", "role", "title"], "-");
    const nip = pick(raw, ["nip", "nik", "employee_id", "no_kamar", "kamar"], "-");
    const gender = pick(raw, ["gender", "jenis_kelamin", "kelamin"], "-");
    const peran = pick(raw, ["peran", "status", "kehadiran", "konfirmasi"], "Peserta");

    return {
      no: pick(raw, ["no", "id", "nomor", "urutan"], String(idx + 1)),
      nama: nama,
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

  /**
   * JSONP Fetch ke Google Sheets.
   * Sangat andal di lingkungan browser karena tag <script> tidak terkena batasan CORS.
   */
  function fetchGvizJsonp(sheetId, tabName, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      if (typeof document === "undefined") {
        return reject(new Error("Lingkungan non-browser tidak mendukung JSONP."));
      }

      const callbackName = "rakerGvizCb_" + Math.random().toString(36).slice(2, 10);
      const script = document.createElement("script");
      let finished = false;

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout memuat tab '" + tabName + "' dari Google Sheets via JSONP."));
      }, timeoutMs);

      function cleanup() {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try {
          delete window[callbackName];
        } catch (_) {
          window[callbackName] = undefined;
        }
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      }

      window[callbackName] = function (data) {
        cleanup();
        try {
          if (!data || !data.table) {
            return reject(new Error("Format tabel Google Sheets tidak valid."));
          }
          const cols = data.table.cols.map((c) =>
            window.RakerCsv.normalizeKey((c && (c.label || c.id)) || "")
          );
          const rows = [];
          (data.table.rows || []).forEach((r) => {
            if (!r || !Array.isArray(r.c)) return;
            const obj = {};
            let hasValue = false;
            r.c.forEach((cell, idx) => {
              const key = cols[idx];
              if (!key) return;
              let val = "";
              if (cell && cell.v !== null && cell.v !== undefined) {
                val = String(cell.v).trim();
                hasValue = true;
              }
              obj[key] = val;
            });
            if (hasValue) rows.push(obj);
          });
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      };

      script.onerror = function () {
        cleanup();
        reject(new Error("Gagal mengeksekusi script Google Sheets JSONP."));
      };

      script.src =
        "https://docs.google.com/spreadsheets/d/" +
        encodeURIComponent(sheetId) +
        "/gviz/tq?tqx=responseHandler:" +
        callbackName +
        "&sheet=" +
        encodeURIComponent(tabName) +
        "&_ts=" +
        Date.now();

      document.head.appendChild(script);
    });
  }

  async function fetchCsvRows(url) {
    const separator = url.includes("?") ? "&" : "?";
    const bustUrl = url + separator + "_ts=" + Date.now();
    const res = await fetch(bustUrl);
    if (!res.ok) {
      throw new Error("HTTP " + res.status + " saat mengambil data CSV.");
    }
    const text = await res.text();
    if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
      throw new Error("Google Sheet belum dibagikan publik ('Anyone with the link -> Viewer').");
    }
    return window.RakerCsv.parse(text);
  }

  /**
   * Mengambil data satu tab dengan waterfall fallback multi-layer:
   * 1. URL CSV khusus (jika ada)
   * 2. JSONP langsung Google Sheets (No CORS issue di browser)
   * 3. Vercel Serverless Function Proxy (/api/sheets)
   * 4. Direct gviz CSV fetch
   */
  async function loadSheetTab(sheetId, tabName, directCsvUrl) {
    if (directCsvUrl) {
      try {
        const rows = await fetchCsvRows(directCsvUrl);
        if (rows && rows.length > 0) return rows;
      } catch (err) {
        console.warn("[RakerSheets] Direct CSV gagal, mencoba fallback:", err);
      }
    }

    if (sheetId && typeof document !== "undefined") {
      try {
        const rows = await fetchGvizJsonp(sheetId, tabName);
        if (rows && rows.length > 0) return rows;
      } catch (err) {
        console.warn("[RakerSheets] JSONP gagal untuk tab '" + tabName + "', mencoba proxy:", err);
      }
    }

    if (sheetId && typeof window !== "undefined" && window.location && window.location.origin) {
      try {
        const proxyUrl = window.location.origin + "/api/sheets?sheetId=" + encodeURIComponent(sheetId) + "&sheet=" + encodeURIComponent(tabName);
        const rows = await fetchCsvRows(proxyUrl);
        if (rows && rows.length > 0) return rows;
      } catch (err) {
        console.warn("[RakerSheets] Proxy /api/sheets gagal, mencoba direct CSV:", err);
      }
    }

    if (sheetId) {
      const fallbackUrl = window.RakerCsv.buildGvizCsvUrl(sheetId, tabName);
      return await fetchCsvRows(fallbackUrl);
    }

    return null;
  }

  async function loadAllData() {
    const settings = getSettings();

    // Mode Apps Script JSON
    if (settings.appsScriptUrl) {
      try {
        const res = await fetch(settings.appsScriptUrl, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          const rundownRaw = Array.isArray(json.rundown) ? json.rundown : [];
          const pesertaRaw = Array.isArray(json.peserta) ? json.peserta : [];
          return {
            mode: "live",
            sourceLabel: "Google Sheets (Apps Script)",
            rundown: rundownRaw.map(normalizeRundownRow),
            peserta: pesertaRaw.map(normalizePesertaRow).filter(Boolean),
            syncedAt: new Date()
          };
        }
      } catch (e) {
        console.warn("[RakerSheets] Apps Script gagal:", e);
      }
    }

    const sheetId = window.RakerCsv.extractSpreadsheetId(settings.spreadsheetUrl);

    if (!sheetId && !settings.rundownCsvUrl && !settings.pesertaCsvUrl) {
      return {
        mode: "demo",
        sourceLabel: "Default Template (Demo)",
        rundown: window.RAKER_DEFAULT_DATA.rundown.slice(),
        peserta: window.RAKER_DEFAULT_DATA.peserta.slice(),
        syncedAt: new Date()
      };
    }

    const [rundownSet, pesertaSet] = await Promise.allSettled([
      loadSheetTab(sheetId, settings.rundownSheetName, settings.rundownCsvUrl),
      loadSheetTab(sheetId, settings.pesertaSheetName, settings.pesertaCsvUrl)
    ]);

    const rundownResult = rundownSet.status === "fulfilled" ? rundownSet.value : null;
    const pesertaResult = pesertaSet.status === "fulfilled" ? pesertaSet.value : null;

    const finalRundown = rundownResult && rundownResult.length
      ? rundownResult.map(normalizeRundownRow)
      : window.RAKER_DEFAULT_DATA.rundown.slice();

    const finalPeserta = pesertaResult && pesertaResult.length
      ? pesertaResult.map(normalizePesertaRow).filter(Boolean)
      : window.RAKER_DEFAULT_DATA.peserta.slice();

    const isLive = Boolean(
      (rundownResult && rundownResult.length > 0) ||
      (pesertaResult && pesertaResult.length > 0)
    );

    return {
      mode: isLive ? "live" : "demo",
      sourceLabel: isLive ? "Google Sheets Live" : "Default Template (Demo)",
      activeSettings: settings,
      rundown: finalRundown,
      peserta: finalPeserta,
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
