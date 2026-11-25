/**
 * Parser CSV RFC-4180 & utilitas URL Google Spreadsheet.
 */
window.RakerCsv = (function () {
  /**
   * Mem-parse teks CSV menjadi array of objects menggunakan baris pertama sebagai header.
   */
  function parse(text) {
    if (!text) return [];
    const clean = text.replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < clean.length; i += 1) {
      const ch = clean[i];
      const next = clean[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i += 1;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field.trim());
        field = "";
      } else if (ch === "\r" || ch === "\n") {
        if (ch === "\r" && next === "\n") {
          i += 1;
        }
        row.push(field.trim());
        if (row.some((cell) => cell !== "")) {
          rows.push(row);
        }
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }

    if (field.length > 0 || row.length > 0) {
      row.push(field.trim());
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
    }

    if (rows.length < 2) return [];

    const headers = rows[0].map((h) => normalizeKey(h));
    const result = [];

    for (let r = 1; r < rows.length; r += 1) {
      const values = rows[r];
      if (!values.some((v) => v !== "")) continue;
      const obj = {};
      headers.forEach((key, idx) => {
        if (key) {
          obj[key] = values[idx] !== undefined ? values[idx] : "";
        }
      });
      result.push(obj);
    }

    return result;
  }

  function normalizeKey(str) {
    return String(str || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  /**
   * Mengekstrak Google Spreadsheet ID dari URL penuh maupun ID langsung.
   */
  function extractSpreadsheetId(input) {
    const trimmed = String(input || "").trim();
    if (!trimmed) return "";
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) return match[1];
    if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
    return "";
  }

  function buildGvizCsvUrl(sheetId, tabName) {
    return (
      "https://docs.google.com/spreadsheets/d/" +
      encodeURIComponent(sheetId) +
      "/gviz/tq?tqx=out:csv&sheet=" +
      encodeURIComponent(tabName)
    );
  }

  function stringify(headers, rows) {
    const escapeCell = (val) => {
      const s = String(val === undefined || val === null ? "" : val);
      if (/[",\r\n]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const lines = [headers.map(escapeCell).join(",")];
    rows.forEach((r) => {
      lines.push(headers.map((h) => escapeCell(r[h])).join(","));
    });
    return "\uFEFF" + lines.join("\r\n");
  }

  return {
    parse,
    normalizeKey,
    extractSpreadsheetId,
    buildGvizCsvUrl,
    stringify
  };
})();
