/**
 * Google Apps Script (Opsional — Gratis 100% Tanpa Database Eksternal)
 * ------------------------------------------------------------------
 * Deploy sebagai Web App:
 * - Execute as: Me
 * - Who has access: Anyone
 * Lalu tempel URL Web App ke config.js -> appsScriptUrl
 */
const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1VHLK_qjf_-vnhYYwoq3Qavz6yHXZoIyNeIjdbUtZODs/edit?usp=sharing";
const ADMIN_PASSWORD = "5555";

function doGet() {
  const props = PropertiesService.getScriptProperties();
  const sheetUrl = props.getProperty("SPREADSHEET_URL") || DEFAULT_SHEET_URL;
  const rundownTab = props.getProperty("RUNDOWN_TAB") || "rundown";
  const pesertaTab = props.getProperty("PESERTA_TAB") || "peserta";

  const ss = SpreadsheetApp.openByUrl(sheetUrl);
  return ContentService.createTextOutput(
    JSON.stringify({
      ok: true,
      spreadsheetUrl: sheetUrl,
      rundown: sheetToObjects(ss.getSheetByName(rundownTab)),
      peserta: sheetToObjects(ss.getSheetByName(pesertaTab))
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  if (String(body.password || "") !== ADMIN_PASSWORD) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Password salah" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const props = PropertiesService.getScriptProperties();
  if (body.spreadsheetUrl) props.setProperty("SPREADSHEET_URL", String(body.spreadsheetUrl).trim());
  if (body.rundownSheetName) props.setProperty("RUNDOWN_TAB", String(body.rundownSheetName).trim());
  if (body.pesertaSheetName) props.setProperty("PESERTA_TAB", String(body.pesertaSheetName).trim());

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetToObjects(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map((h) => String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""));
  return values.slice(1).filter((r) => r.some((c) => c !== "")).map((row) => {
    const obj = {};
    headers.forEach((k, i) => {
      if (k) obj[k] = row[i] !== undefined ? String(row[i]) : "";
    });
    return obj;
  });
}
