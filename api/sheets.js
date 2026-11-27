/**
 * Vercel Serverless Function Proxy for Google Sheets.
 * Eliminates CORS issues in browser fetch requests.
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=60");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const sheetId = req.query.sheetId || "1VHLK_qjf_-vnhYYwoq3Qavz6yHXZoIyNeIjdbUtZODs";
  const sheet = req.query.sheet || "peserta";

  try {
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
    const upstream = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "Failed to fetch upstream Google Sheet: " + upstream.statusText });
    }
    const csv = await upstream.text();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
