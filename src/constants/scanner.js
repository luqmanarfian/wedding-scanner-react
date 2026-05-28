export const SCANNER_CONFIG = {
  FPS: 10,
  QR_BOX_RATIO: 0.7, // 70% of viewport width/height
};

export const SCANNER_ERRORS = {
  NOT_SECURE: 'NOT_SECURE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  IN_USE: 'IN_USE',
  INITIALIZATION_ERROR: 'INITIALIZATION_ERROR',
};

export const SCANNER_ERROR_MESSAGES = {
  [SCANNER_ERRORS.NOT_SECURE]: {
    title: 'HTTPS Dibutuhkan',
    message: 'Aplikasi membutuhkan koneksi HTTPS aman untuk mengakses kamera. Harap buka aplikasi menggunakan protokol HTTPS atau gunakan localhost.',
  },
  [SCANNER_ERRORS.PERMISSION_DENIED]: {
    title: 'Akses Kamera Ditolak',
    message: 'Izin akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser Anda, lalu klik "Coba Lagi".',
  },
  [SCANNER_ERRORS.NOT_FOUND]: {
    title: 'Kamera Tidak Ditemukan',
    message: 'Perangkat Anda tidak memiliki kamera, atau kamera tidak terdeteksi oleh browser.',
  },
  [SCANNER_ERRORS.IN_USE]: {
    title: 'Kamera Sedang Digunakan',
    message: 'Kamera sedang digunakan oleh aplikasi lain atau tab browser lain. Silakan tutup aplikasi/tab tersebut dan klik "Coba Lagi".',
  },
  [SCANNER_ERRORS.INITIALIZATION_ERROR]: {
    title: 'Gagal Membuka Kamera',
    message: 'Terjadi kesalahan saat menginisialisasi kamera. Silakan periksa koneksi kamera perangkat Anda dan klik "Coba Lagi".',
  },
};
