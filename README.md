# Wedding Scanner (React)

Aplikasi web pendamping untuk melakukan pemindaian (scan) QR Code tamu di lokasi acara pernikahan. Aplikasi ini dirancang untuk memindai QR Code yang sebelumnya telah digenerate dan dibagikan melalui project **"undangan-pernikahan"**. 

Data hasil pemindaian akan langsung diverifikasi dan disinkronkan secara *real-time* ke Google Sheets melalui Google Apps Script API.

---

## Gambaran Umum

Aplikasi ini digunakan oleh panitia/penerima tamu (*usher*) untuk mempermudah dan mempercepat proses registrasi kehadiran di lokasi acara (venue). 

**Alur Kerja Sistem:**
1. Tamu membawa undangan digital (dari project *undangan-pernikahan*) yang berisi QR Code unik.
2. Panitia membuka aplikasi *Wedding Scanner* ini melalui perangkat mereka (HP/Tablet/Laptop).
3. Panitia memasukkan PIN Keamanan agar kamera bisa diakses (mencegah akses tanpa izin).
4. Panitia memindai QR Code milik tamu menggunakan kamera perangkat.
5. Aplikasi mengirimkan ID QR tersebut ke backend (Google Apps Script).
6. Sistem memeriksa data tamu di database Google Sheets.
7. Jika data valid dan tamu belum check-in, sistem menampilkan status **Sukses** beserta nama dan jumlah orang (pax).
8. Status tamu di Google Sheets otomatis diperbarui menjadi "Hadir" agar tidak bisa check-in dua kali.
9. Jika tamu mencoba check-in lagi, sistem akan memunculkan peringatan **Sudah Check-in**.

**Diagram Alur:**
```txt
 Undangan Pernikahan (Tamu)
        [ QR Code ]
             |
             v
 Kamera Panitia (Scanner App)
             | (Validasi & Kirim ID)
             v
   Backend / API (Google Apps Script)
             |
             v
 Database (Google Sheets) <--> (Cek Status Kehadiran)
             |
             v
 Tampilan Status di Layar Panitia 
 (Sukses / Sudah Check-in / Tidak Valid)
```

---

## Fitur Utama

- **Pemindai QR Cepat & Akurat:** Menggunakan pustaka `html5-qrcode` yang responsif.
- **Integrasi Penuh:** Membaca hasil QR Code yang dihasilkan langsung dari project *undangan-pernikahan*.
- **Keamanan PIN:** Mencegah sembarang orang mengakses fitur kamera dan API.
- **Dukungan Multi-Kamera:** Panitia bisa berganti lensa kamera (depan, belakang, atau ultrawide) sesuai kebutuhan.
- **Validasi Ganda:** Memastikan satu QR Code hanya bisa digunakan untuk check-in satu kali.
- **Desain Modern:** Antarmuka dengan efek *glassmorphism* menggunakan Tailwind CSS yang memanjakan mata.
- **Aman untuk Publikasi:** Tidak ada rahasia atau kunci (API Key) yang di-*hardcode* di dalam source code (menggunakan *Environment Variables*).
- **Siap Produksi (DevOps Ready):** Dilengkapi dengan *Dockerfile*, *Jenkinsfile* untuk CI/CD pipeline, konfigurasi *Nginx*, dan *Helm Chart* untuk deployment Kubernetes.

---

## Prasyarat

Pastikan komputer Anda sudah terinstal perangkat lunak berikut:
- **Node.js** (versi 18 atau lebih baru)
- **npm** atau **yarn**
- **Git**

## Cara Menjalankan di Komputer Lokal

1. **Clone repository ini**
   ```bash
   git clone <URL_REPOSITORY_ANDA>
   cd wedding-scanner
   ```

2. **Install dependensi**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment Variables**
   File sensitif tidak disertakan di repositori publik demi keamanan. Anda harus membuat file `.env` sendiri.
   - Salin file `.env.example` menjadi `.env`:
     ```bash
     cp .env.example .env
     ```
   - Buka `.env` dan masukkan konfigurasi Anda:
     ```env
     VITE_APP_PIN=121212
     VITE_API_URL=https://script.google.com/macros/s/YOUR_APPS_SCRIPT_ID/exec
     ```

4. **Jalankan server lokal**
   ```bash
   npm run dev -- --host
   ```
   *Catatan:* Flag `--host` diperlukan agar aplikasi bisa diakses dari perangkat HP Anda yang berada dalam satu jaringan WiFi yang sama (misal `https://192.168.0.x:5173`). Akses HTTPS sudah didukung secara lokal melalui plugin Vite `basic-ssl` karena browser mewajibkan HTTPS untuk mengakses kamera.

---

## Panduan Deployment (Server Production)

Project ini memiliki beberapa opsi deployment siap pakai:

**1. Menggunakan Docker (Rekomendasi Paling Mudah)**
Build image secara lokal dan jalankan kontainernya:
```bash
docker build -t wedding-scanner .
docker run -d -p 8080:8080 wedding-scanner
```
Aplikasi bisa diakses di `http://localhost:8080`.

**2. Menggunakan Kubernetes & Helm**
Jika Anda memiliki cluster Kubernetes, gunakan Helm chart yang sudah disediakan:
```bash
helm install wedding-scanner ./helm/charts
```

**3. Pipeline Otomatis (Jenkins)**
Jika menggunakan Jenkins, file `Jenkinsfile` di *root* direktori sudah mengonfigurasi alur CI/CD secara penuh: pengujian otomatis, analisis SonarQube, pemindaian kerentanan image dengan Trivy, dan deployment ke Kubernetes.

---

## Struktur Folder Utama

```text
src/
├── assets/         # Gambar statis dan icon
├── constants/      # Konstanta teks aplikasi
├── hooks/          # Custom React hooks (contoh: useQrScanner)
├── pages/          # Halaman antarmuka (LoginPage, ScannerPage)
├── services/       # File pemanggil API Google Sheets (checkInApi.js)
├── App.jsx         # Router & Entry point UI
└── main.jsx        # Root render React
```
