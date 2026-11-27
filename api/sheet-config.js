/**
 * Vercel Serverless Function: /api/sheet-config
 * Menyimpan & membagikan URL Google Spreadsheet aktif ke seluruh pengunjung website.
 *
 * Environment Variables (opsional di Vercel Dashboard -> Settings -> Environment Variables):
 * - KV_REST_API_URL & KV_REST_API_TOKEN (Vercel KV / Upstash Redis)
 * - ADMIN_PASSWORD (default: "5555")
 */
const DEFAULT_CONFIG = {
  spreadsheetUrl:
    "https://docs.google.com/spreadsheets/d/1VHLK_qjf_-vnhYYwoq3Qavz6yHXZoIyNeIjdbUtZODs/edit?usp=sharing",
  rundownSheetName: "rundown",
  pesertaSheetName: "peserta",
  rundownCsvUrl: "",
  pesertaCsvUrl: ""
};

const KV_KEY = "raker2027:sheet_config";

async function kvGet(url, token) {
  const res = await fetch(`${url}/get/${encodeURIComponent(KV_KEY)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json || !json.result) return null;
  return typeof json.result === "string" ? JSON.parse(json.result) : json.result;
}

async function kvSet(url, token, value) {
  const res = await fetch(`${url}/set/${encodeURIComponent(KV_KEY)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(JSON.stringify(value))
  });
  return res.ok;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const adminPassword = process.env.ADMIN_PASSWORD || "5555";

  if (req.method === "GET") {
    if (kvUrl && kvToken) {
      try {
        const stored = await kvGet(kvUrl, kvToken);
        if (stored && stored.spreadsheetUrl) {
          return res.status(200).json({ ok: true, persistent: true, config: stored });
        }
      } catch (_) {
        // Fall back to default
      }
    }
    return res.status(200).json({ ok: true, persistent: Boolean(kvUrl && kvToken), config: DEFAULT_CONFIG });
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    if (String(body.password || "") !== String(adminPassword)) {
      return res.status(401).json({ ok: false, error: "Password admin tidak valid." });
    }

    const nextConfig = {
      spreadsheetUrl: String(body.spreadsheetUrl || "").trim() || DEFAULT_CONFIG.spreadsheetUrl,
      rundownSheetName: String(body.rundownSheetName || "rundown").trim(),
      pesertaSheetName: String(body.pesertaSheetName || "peserta").trim(),
      rundownCsvUrl: String(body.rundownCsvUrl || "").trim(),
      pesertaCsvUrl: String(body.pesertaCsvUrl || "").trim(),
      updatedAt: new Date().toISOString()
    };

    if (!kvUrl || !kvToken) {
      return res.status(200).json({
        ok: true,
        persistent: false,
        message: "KV belum terpasang di Vercel; konfigurasi disimpan di browser lokal.",
        config: nextConfig
      });
    }

    const saved = await kvSet(kvUrl, kvToken, nextConfig);
    if (!saved) {
      return res.status(500).json({ ok: false, error: "Gagal menyimpan ke storage Vercel KV." });
    }
    return res.status(200).json({ ok: true, persistent: true, config: nextConfig });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
};
