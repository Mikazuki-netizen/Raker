/**
 * KONFIGURASI DATABASE SPREADSHEET — RAKER 2027
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
  spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1VHLK_qjf_-vnhYYwoq3Qavz6yHXZoIyNeIjdbUtZODs/edit?usp=sharing",

  // Nama tab di Google Spreadsheet (case-sensitive sesuai nama tab)
  rundownSheetName: "rundown",
  pesertaSheetName: "peserta",

  // Opsional: Jika menggunakan "Publish to web" (CSV) per tab, isi URL di bawah ini
  rundownCsvUrl: "",
  pesertaCsvUrl: "",

  // Opsional: Jika menggunakan Google Apps Script Web App URL (mengembalikan JSON { rundown: [...], peserta: [...] })
  appsScriptUrl: "",

  // Metadata acara (tampil di halaman undangan)
  event: {
    badge: "Rapat Kerja Nasional 2027",
    title: "Raker & Gathering 2027",
    theme: "Akselerasi Transformasi Digital untuk membangun Inovasi, Produktivitas dan Daya Saing",
    location: "De Djokja Hotel",
    city: "Yogyakarta",
    dateRange: "11 – 13 Januari 2027",
    mapEmbedQuery: "De Djokja Hotel Yogyakarta",
    dressCodes: [
      {
        day: 1,
        date: "Minggu, 11 Jan 2027",
        label: "Day 1 · Kedatangan & Pembukaan",
        attire: "Kemeja / Blus Putih & Celana Cream",
        notes: "Tampil rapi dan seragam sejak keberangkatan hingga sesi pembukaan.",
        accent: "day1"
      },
      {
        day: 2,
        date: "Senin, 12 Jan 2027",
        label: "Day 2 · Raker Inti & Diskusi",
        attire: "Seragam Kantor / Korporat",
        notes: "Gunakan ID Card peserta selama seluruh rangkaian sidang pleno dan komisi.",
        accent: "day2"
      },
      {
        day: 3,
        date: "Selasa, 13 Jan 2027",
        label: "Day 3 · Penutupan & Adat Jogja",
        attire: "Co: Surjan / Beskap · Ce: Janggan / Kutu Baru, Celana / Rok Kain",
        notes: "Nuansa busana tradisional Yogyakarta sebelum agenda penutupan & kepulangan.",
        accent: "day3"
      }
    ],

    // Galeri Memori Raker (foto historis PT SIBA SURYA — format WebP teroptimasi)
    memories: [
      {
        id: "mem-2023",
        image: "assets/raker-2023-malang.webp",
        year: "2023",
        location: "Malang",
        caption: "RAKER 2023 — Kebersamaan & Kolaborasi PT SIBA SURYA di Malang"
      },
      {
        id: "mem-2024",
        image: "assets/raker-2024-tawangmangu.webp",
        year: "2024",
        location: "Tawangmangu",
        caption: "RAKER 2024 — Melompat Tinggi dengan Ekspansi Strategis & Perbaikan Kualitas Pelayanan"
      },
      {
        id: "mem-2025",
        image: "assets/raker-2025-bandung.webp",
        year: "2025",
        location: "Bandung",
        caption: "RAKER 2025 — Bigger, Better & More Sustainable"
      },
      {
        id: "mem-2026",
        image: "assets/raker-2026-bali.webp",
        year: "2026",
        location: "Bali",
        caption: "RAKER 2026 — Kebersamaan & Kolaborasi PT SIBA SURYA di Bali"
      }
    ]
  }
};
