# Website Raker & Gathering 2027 — De Djokja Hotel

Website undangan resmi, peta rute interaktif (dari berangkat hingga pulang kembali), dan daftar peserta interaktif dengan **Google Spreadsheet sebagai database**.

---

## Fitur Utama

1. **Halaman Undangan & Dress Code Harian**
   - Tema: *"Akselerasi Transformasi Digital untuk membangun Inovasi, Produktivitas dan Daya Saing"*
   - Lokasi: **De Djokja Hotel**, Yogyakarta (`11 – 13 Jan 2027`)
   - Kartu Dress Code Interaktif Day 1, Day 2, dan Day 3 (klik kartu untuk langsung melompat ke rute hari tersebut).
2. **Peta Rute Perjalanan & Rundown Interaktif (Field Map)**
   - Menampilkan alur lengkap mulai dari **Zona Berangkat** → **Kompleks De Djokja Hotel** (Lobby, Ballroom Mataram, Pendopo Budaya) → **Zona Kepulangan**.
   - Filter per hari (`Semua Rute`, `Day 1`, `Day 2`, `Day 3`), pencarian agenda, serta tombol navigasi langkah (`Prev`/`Next` atau panah kiri/kanan keyboard).
   - Titik rute di peta tersusun otomatis mengikuti kolom `fase` pada Google Spreadsheet (`berangkat`, `hotel`, `raker`, `ishoma`, `budaya`, `pulang`).
3. **Tabel Daftar Peserta Interaktif**
   - Pencarian cepat berdasarkan nama, jabatan, divisi, bus, atau nomor kamar.
   - Filter berdasarkan Divisi, Transport/Bus, dan Status Kehadiran, serta pengurutan kolom.
   - Klik baris peserta untuk membuka modal detail (kontak, ukuran seragam, catatan khusus, kamar, dan transport), plus tombol **Export CSV**.
4. **Database Google Spreadsheet (Live Sync)**
   - Ubah jadwal rundown atau daftar peserta langsung di Google Spreadsheet — website akan mengambil data terbaru setiap kali dibuka atau saat tombol **Refresh** ditekan.

---

## Cara Menghubungkan Google Spreadsheet

### Langkah 1 — Siapkan Google Spreadsheet
1. Buat Google Spreadsheet baru di [Google Sheets](https://sheets.google.com).
2. Buat **2 tab** dengan nama persis:
   - `Rundown`
   - `Peserta`
3. Impor file template yang sudah disediakan di folder `templates/`:
   - Di tab `Rundown` → `File → Import → Upload` → pilih `templates/rundown_template.csv` (`Replace current sheet`).
   - Di tab `Peserta` → `File → Import → Upload` → pilih `templates/peserta_template.csv` (`Replace current sheet`).

### Langkah 2 — Atur Akses Bagikan (Share)
1. Klik tombol **Share** di kanan atas Google Spreadsheet.
2. Pada bagian **General access**, ubah dari *Restricted* menjadi **Anyone with the link** dengan peran **Viewer**.
3. Salin link Google Spreadsheet Anda.

### Langkah 3 — Pasang ke Website
Ada dua cara:
- **Untuk Semua Pengunjung (Permanen):** Buka file `config.js`, lalu tempelkan link Google Spreadsheet Anda pada `spreadsheetUrl`:
  ```js
  spreadsheetUrl: "https://docs.google.com/spreadsheets/d/ID_SPREADSHEET_ANDA/edit",
  ```
- **Uji Coba Langsung di Browser:** Buka website, klik tombol **Mode Demo** di kanan atas navbar, tempel link Google Spreadsheet Anda, lalu klik **Hubungkan & Muat Data**.

---

## Menjalankan Secara Lokal

Jalankan server statis sederhana dari folder proyek (agar `fetch()` CSV berfungsi tanpa kendala CORS `file://`):

```bash
python -m http.server 8080
```

Lalu buka `http://localhost:8080` di browser.

---

## Menayangkan ke Internet (Gratis)

Karena website ini bersifat statis (HTML + CSS + JS murni tanpa build step), Anda cukup mengunggah seluruh folder proyek ke:
- **Netlify Drop** (`app.netlify.com/drop`)
- **Cloudflare Pages** / **Vercel** / **GitHub Pages**
