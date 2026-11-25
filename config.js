/**
 * KONFIGURASI DATABASE SPREADSHEET — RAKER 2026
 * ---------------------------------------------------------------------------
 * Cara menghubungkan Google Spreadsheet:
 * 1. Buka Google Spreadsheet Anda.
 * 2. Pastikan memiliki dua tab bernama: "Rundown" dan "Peserta"
 *    (atau sesuaikan nama tab di bawah ini).
 * 3. Klik "Share" (Bagikan) -> ubah akses umum menjadi:
 *    "Anyone with the link" (Siapa saja yang memiliki link) -> "Viewer" (Pelihat).
 * 4. Salin link Google Spreadsheet Anda dan tempelkan ke `spreadsheetUrl` di bawah.
 *
 * Alternatif: Anda juga bisa menggunakan "File -> Share -> Publish to web"
 * lalu tempelkan URL CSV masing-masing tab ke `rundownCsvUrl` dan `pesertaCsvUrl`.
 */
window.RAKER_CONFIG = {
  // Tempelkan link Google Spreadsheet utama Anda di sini, contoh:
  // "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit"
  spreadsheetUrl: "",

  // Nama tab di Google Spreadsheet (case-sensitive sesuai nama tab)
  rundownSheetName: "Rundown",
  pesertaSheetName: "Peserta",

  // Opsional: Jika menggunakan "Publish to web" (CSV) per tab, isi URL di bawah ini
  rundownCsvUrl: "",
  pesertaCsvUrl: "",

  // Opsional: Jika menggunakan Google Apps Script Web App URL (mengembalikan JSON { rundown: [...], peserta: [...] })
  appsScriptUrl: "",

  // Metadata acara (tampil di halaman undangan)
  event: {
    badge: "Rapat Kerja Nasional 2026",
    title: "Raker & Gathering 2026",
    theme: "Akselerasi Transformasi Digital untuk membangun Inovasi, Produktivitas dan Daya Saing",
    location: "De Djokja Hotel",
    city: "Yogyakarta",
    dateRange: "11 – 13 Januari 2026",
    mapEmbedQuery: "De Djokja Hotel Yogyakarta",
    dressCodes: [
      {
        day: 1,
        date: "Minggu, 11 Jan 2026",
        label: "Day 1 · Kedatangan & Pembukaan",
        attire: "Kemeja / Blus Putih & Celana Cream",
        notes: "Tampil rapi dan seragam sejak keberangkatan hingga sesi pembukaan.",
        accent: "day1"
      },
      {
        day: 2,
        date: "Senin, 12 Jan 2026",
        label: "Day 2 · Raker Inti & Diskusi",
        attire: "Seragam Kantor / Korporat",
        notes: "Gunakan ID Card peserta selama seluruh rangkaian sidang pleno dan komisi.",
        accent: "day2"
      },
      {
        day: 3,
        date: "Selasa, 13 Jan 2026",
        label: "Day 3 · Penutupan & Adat Jogja",
        attire: "Co: Surjan / Beskap · Ce: Janggan / Kutu Baru, Celana / Rok Kain",
        notes: "Nuansa busana tradisional Yogyakarta sebelum agenda penutupan & kepulangan.",
        accent: "day3"
      }
    ]
  }
};
