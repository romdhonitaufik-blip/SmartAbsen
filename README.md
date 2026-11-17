# HR-Presensi & Manajemen Izin, Sakit, dan Cuti Karyawan

Aplikasi Web Modern untuk Manajemen Kehadiran (Absensi), Pengajuan Izin, Sakit, dan Cuti Karyawan berbasis Web (Client-Side Reactive SPA) yang siap digunakan langsung tanpa konfigurasi server tambahan.

---

## 🌟 Fitur Utama

### 1. 🕒 Absensi Kehadiran (Clock-In & Clock-Out)
- **Jam Digital Real-time**: Penunjuk waktu akurat dengan format zona waktu Indonesia (WIB/WITA/WIT).
- **Validasi Kamera Selfie**: Pengambilan foto selfie langsung via webcam/kamera smartphone untuk mencegah kecurangan kehadiran.
- **Validasi Geolokasi GPS**: Deteksi koordinat pengguna secara otomatis menggunakan formula Haversine untuk mengukur jarak fisik ke kantor:
  - *Di Dalam Radius Kantor (WFO)* jika jarak $\le$ radius toleransi.
  - *Di Luar Radius Kantor (WFH / Dinas Luar)* jika di luar toleransi.
- **Pencatatan Status Otomatis**: Otomatis mendeteksi status *Tepat Waktu* atau *Terlambat* (berdasarkan batas jam masuk yang ditentukan perusahaan, misal 08:30 WIB).
- **Perhitungan Jam Kerja Otomatis**: Menghitung durasi jam kerja secara presisi saat karyawan melakukan *Absen Pulang (Clock Out)*.

### 2. 📝 Pengajuan Izin, Sakit & Cuti Mandiri (Employee Self-Service)
- **Formulir Izin**: Pilihan kategori keperluan pribadi, keterlambatan, pulang awal, atau tugas luar kota.
- **Formulir Sakit**: Pilihan jenis sakit (rawat jalan/inap) dan unggah foto/dokumen **Surat Keterangan Dokter**.
- **Formulir Cuti**:
  - Pelacakan kuota cuti tahunan dinamis (standar 12 hari).
  - Validasi otomatis: Karyawan tidak dapat mengajukan cuti melebihi sisa kuota yang dimiliki.
  - Pilihan jenis cuti: Tahunan, Menikah, Melahirkan, Duka Cita, Keagamaan.
  - Menghitung durasi hari kerja secara otomatis.

### 3. 🛡️ Pusat Persetujuan HRD (Approval Center)
- Dashboard pemantauan seluruh pengajuan karyawan berstatus *Pending*.
- Tombol satu-klik untuk **Menyetujui (Approve)** atau **Menolak (Reject)** dengan catatan/alasan review untuk karyawan.
- **Pemotongan Kuota Cuti Otomatis**: Saat HRD menyetujui pengajuan cuti, kuota cuti karyawan langsung terpotong secara otomatis.
- **Pencatatan Riwayat Otomatis**: Pengajuan yang disetujui otomatis masuk ke rekapitulasi data absensi.

### 4. 📊 Dashboard KPI & Laporan Kehadiran (HR Analytics)
- Ringkasan harian: Total Karyawan, Hadir Hari Ini, Terlambat, Sedang Izin, Sakit, dan Cuti.
- **Filter Laporan Komprehensif**: Filter berdasarkan Bulan, Departemen, Karyawan, dan Status Kehadiran.
- **Ekspor ke Excel / CSV**: Download file spreadsheet laporan kehadiran dengan satu kali klik.
- **Cetak Laporan Siap PDF**: Tampilan cetak yang telah dioptimasi khusus untuk format A4/PDF.

### 5. 👥 Manajemen Data Master Karyawan
- Tambah karyawan baru, ubah data staf (NIP, Departemen, Posisi, No. Handphone).
- Pengaturan alokasi hak kuota cuti tahunan per individu atau reset massal.

### 6. ⚙️ Pengaturan Kantor & Basis Data
- Pengaturan Nama Perusahaan, Jam Masuk, Jam Pulang, dan Toleransi Keterlambatan.
- Penentuan titik GPS kantor: terdapat tombol *Set Titik Kantor dari GPS Saya Saat Ini*.
- Toleransi radius kehadiran (misal 150 meter).
- **Cadangan Data (Backup JSON)** & **Pemulihan Data (Restore JSON)**.
- Penyimpanan lokal (*LocalStorage*) yang aman dan persisten di browser.

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi ini bersifat **Zero-Setup** dan dapat langsung dibuka di browser modern apa saja (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari) tanpa perlu menginstal Node.js atau web server.

### Langkah Membuka:
1. Masuk ke folder proyek: `D:\PROJECT\PROJECT_2\`
2. Klik ganda (double-click) pada berkas `index.html`, atau klik kanan lalu pilih **Open with > Google Chrome / Microsoft Edge**.
3. Aplikasi akan langsung berjalan.

---

## 👤 Akun Pengujian / Simulasi

Aplikasi telah dilengkapi data simulasi realistis untuk pengujian langsung:

| Role | Nama Pengguna | Departemen / Posisi | Akses Fitur |
| :--- | :--- | :--- | :--- |
| **Karyawan** | Budi Santoso, S.Kom | IT (Senior Developer) | Absen Selfie, GPS, Ajukan Cuti/Sakit |
| **Karyawan** | Siti Rahmawati, S.E | Finance & Accounting | Pengajuan Izin & Absensi |
| **Karyawan** | Ahmad Fauzi, S.Ds | Product & Design | Pengajuan Sakit & Absensi |
| **Karyawan** | Dewi Lestari, S.I.Kom | Marketing | Pengajuan Cuti & Absensi |
| **Admin / HRD** | Maya Anggraini, S.Psi | HR & People Ops Manager | Approval Center, Master Data, Rekap & Laporan |

> *Catatan:* Anda dapat berganti antara **Mode Karyawan** dan **Mode Admin / HRD** kapan saja menggunakan tombol pengalih (*pill switcher*) di bagian atas layar.
