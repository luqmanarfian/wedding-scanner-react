import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useCameraPermission from '../hooks/useCameraPermission';
import useQrScanner from '../hooks/useQrScanner';
import { scanQrCode } from '../services/checkInApi';
import { SCANNER_ERROR_MESSAGES } from '../constants/scanner';

/**
 * Decodes a stored guest name that may contain HTML entities (legacy data).
 * Uses the browser's DOMParser for safe decoding — no innerHTML.
 *
 * After the Apps Script fix (normalizeForStorage), new data is stored as
 * plain text and this function acts as a no-op passthrough. It exists for
 * backward compatibility with data that was HTML-escaped before the fix.
 *
 * @param {string} value - Potentially HTML-encoded name from storage
 * @returns {string} Decoded plain-text name
 */
function decodeStoredGuestName(value) {
  if (!value || typeof value !== 'string') return value || '';

  // Quick check: if no HTML entities are present, return as-is
  if (!/&\w+;|&#\w+;/.test(value)) return value;

  try {
    const doc = new DOMParser().parseFromString(value, 'text/html');
    return doc.body.textContent || value;
  } catch {
    return value;
  }
}

export default function ScannerPage() {
  const navigate = useNavigate();

  // Custom hooks
  const { permissionState, requestPermission } = useCameraPermission();

  const [scanResult, setScanResult] = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(false);

  // Ref untuk menghindari temporal dead zone (TDZ) dari fungsi hook
  const scannerControlsRef = useRef({ pause: () => { }, stop: () => Promise.resolve() });

  // Success sound/vibration feedback
  const playFeedback = (success) => {
    try {
      if (navigator.vibrate) {
        navigator.vibrate(success ? [100, 50, 100] : [300]);
      }
    } catch (e) {
      console.warn('Vibration API not supported or blocked:', e);
    }
  };

  const onScanSuccess = async (decodedText) => {
    // 1. Pause camera scanning immediately to avoid duplicate reads while loading
    scannerControlsRef.current.pause();
    playFeedback(true);

    // 2. Set UI states
    setApiLoading(true);
    setIsScannerActive(false);

    try {
      // 3. Panggil API backend sheet
      const response = await scanQrCode(decodedText);
      setScanResult(response);
    } catch (err) {
      console.error('Failed to run check-in API:', err);
      setScanResult({ result: 'error', message: 'Gagal menghubungi server. Periksa koneksi internet.' });
    } finally {
      setApiLoading(false);
      // 4. Hentikan kamera untuk menghemat daya saat menampilkan hasil
      scannerControlsRef.current.stop();
    }
  };

  const {
    cameras,
    activeCamera,
    isInitializing,
    isScanning,
    error: scannerError,
    startScanner,
    stopScanner,
    pauseScanner,
  } = useQrScanner('qr-reader', onScanSuccess);

  // Sinkronisasikan control functions ke ref
  useEffect(() => {
    scannerControlsRef.current = {
      pause: pauseScanner,
      stop: stopScanner,
    };
  }, [pauseScanner, stopScanner]);

  // 1. Cek Auth
  useEffect(() => {
    if (sessionStorage.getItem('scanner_auth') !== 'true') {
      navigate('/');
    }
  }, [navigate]);

  // 2. Auto-start scanner saat permission OK dan state scanning aktif
  useEffect(() => {
    if (permissionState === 'granted' && isScannerActive && !isScanning && !isInitializing) {
      startScanner();
    }
  }, [permissionState, isScannerActive, isScanning, isInitializing, startScanner]);

  // Handler Mulai/Ulangi Scan
  const handleStartScan = () => {
    setScanResult(null);
    setIsScannerActive(true);
  };

  // Handler Minta Izin Kamera Manual
  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (granted) {
      setIsScannerActive(true);
    }
  };

  const handleLogout = () => {
    stopScanner().then(() => {
      sessionStorage.removeItem('scanner_auth');
      navigate('/');
    });
  };

  // Tentukan state visual utama
  const showError = scannerError !== null;
  const showPermissionGuide = permissionState === 'denied' || (permissionState === 'prompt' && !isScannerActive);
  const showResultUi = scanResult !== null;
  const showInitState = !isScannerActive && !scanResult && !apiLoading && permissionState !== 'denied';

  return (
    <div className="min-h-screen bg-gradient-to-tr from-blush-50 via-white to-pink-50 flex flex-col p-4 md:p-8 w-full max-w-md md:max-w-6xl mx-auto relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] aspect-square rounded-full bg-blush-100/40 blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] aspect-square rounded-full bg-pink-100/40 blur-[100px] pointer-events-none z-0"></div>

      <div className="relative z-10 flex-1 flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center py-4 border-b border-blush-100 mb-6">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-blush-900 leading-tight">QR Scanner</h1>
            <p className="text-xs text-text-light font-sans">Sistem Check-in Tamu</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-3.5 py-2 text-sm border border-blush-200 text-blush-700 hover:bg-blush-50 font-bold rounded-xl transition-all shadow-sm"
          >
            Keluar
          </button>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col justify-center">

          {/* A. STATE KHUSUS: Panduan Izin Akses Kamera (Sebelum Masuk Workspace) */}
          {showPermissionGuide && (
            <div className="w-full max-w-md mx-auto glass-card p-6 md:p-8 rounded-3xl text-center space-y-5 animate-fade-in shadow-xl">
              <div className="w-16 h-16 bg-blush-100 text-blush-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl md:text-2xl font-bold text-blush-900 font-serif">Izin Kamera Diperlukan</h2>
                <p className="text-sm text-text-light leading-relaxed">
                  Aplikasi ini membutuhkan akses kamera perangkat Anda untuk memindai QR Code undangan tamu.
                </p>
              </div>

              {permissionState === 'denied' && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs text-left leading-normal border border-red-100">
                  <strong>Cara mengaktifkan:</strong> Klik ikon gembok di sebelah kiri URL browser Anda, aktifkan izin Kamera, kemudian segarkan (refresh) halaman ini.
                </div>
              )}

              <button
                onClick={handleRequestPermission}
                className="w-full bg-blush-600 hover:bg-blush-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md active:scale-95"
              >
                Aktifkan Kamera
              </button>
            </div>
          )}

          {/* B. MAIN DESKTOP WORKSPACE (Setelah Permission Granted) */}
          {permissionState === 'granted' && (
            <div className="w-full md:grid md:grid-cols-2 md:gap-12 md:items-start">

              {/* KOLOM KIRI: Kamera / Viewport Container */}
              <div className={`flex-col items-center w-full ${isScanning || isInitializing || showError ? 'flex' : 'hidden md:flex'
                }`}>

                {/* 1. Viewport: Standby Camera Placeholder */}
                {!isScanning && !isInitializing && !showError && (
                  <div className="w-full bg-slate-900 text-white rounded-3xl overflow-hidden aspect-square max-h-[350px] md:max-h-none flex flex-col items-center justify-center p-6 border-4 border-white shadow-xl relative animate-fade-in">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-blush-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                    <p className="text-sm font-semibold tracking-wide text-slate-300 mb-1">Kamera Standby</p>
                    <p className="text-xs text-slate-400 text-center mb-5 max-w-xs">Tekan tombol di bawah untuk menyalakan kamera</p>
                    <button
                      onClick={handleStartScan}
                      className="px-5 py-2.5 bg-blush-600 hover:bg-blush-700 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-95"
                    >
                      Nyalakan Kamera
                    </button>
                  </div>
                )}

                {/* 2. Viewport: Error Handler Kamera */}
                {showError && (
                  <div className="w-full bg-red-50 border border-red-200 text-red-900 rounded-3xl p-6 text-center space-y-4 shadow-md animate-fade-in max-w-md mx-auto">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                      </svg>
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-red-800 text-sm">
                        {SCANNER_ERROR_MESSAGES[scannerError]?.title || 'Gagal Membuka Kamera'}
                      </h4>
                      <p className="text-xs text-slate-600 leading-normal">
                        {SCANNER_ERROR_MESSAGES[scannerError]?.message || 'Terjadi kesalahan sistem.'}
                      </p>
                    </div>
                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        onClick={handleStartScan}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all shadow-sm"
                      >
                        Coba Lagi
                      </button>
                      <button
                        onClick={() => {
                          stopScanner();
                          setIsScannerActive(false);
                          setScanResult(null);
                        }}
                        className="w-full text-[11px] text-slate-500 hover:text-slate-800 font-bold py-1.5 transition-all"
                      >
                        Kembali ke Awal
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Viewport: Active Video Feed & Loading Overlay */}
                <div className={`w-full flex-col items-center ${(isInitializing || isScanning) && !showError ? 'flex' : 'hidden'}`}>
                  <div className="relative w-full bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-white aspect-square max-h-[350px] md:max-h-none">

                    {/* Container DOM html5-qrcode (harus dirender agar ukurannya terbaca) */}
                    <div id="qr-reader" className="w-full h-full object-cover"></div>

                    {/* Loading Overlay */}
                    {isInitializing && (
                      <div className="absolute inset-0 z-20 bg-slate-950 flex flex-col items-center justify-center p-8 animate-fade-in">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blush-400 mb-4"></div>
                        <p className="text-xs text-slate-400 font-medium">Menghubungkan ke lensa kamera...</p>
                      </div>
                    )}

                    {/* Laser Overlay (tampil saat scanning) */}
                    {isScanning && !isInitializing && (
                      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4">
                        <div className="bg-black/60 text-white text-[10px] md:text-xs px-3 py-1.5 rounded-full mx-auto backdrop-blur-sm tracking-wide font-medium">
                          Posisikan QR Code di dalam kotak
                        </div>

                        <div className="relative w-44 h-44 md:w-56 md:h-56 lg:w-64 lg:h-64 mx-auto flex items-center justify-center">
                          <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blush-500 rounded-tl-xl"></div>
                          <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blush-500 rounded-tr-xl"></div>
                          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blush-500 rounded-bl-xl"></div>
                          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blush-500 rounded-br-xl"></div>

                          <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-blush-500 to-transparent animate-scan-laser shadow-[0_0_10px_#db2777]"></div>
                        </div>

                        <div className="h-6"></div>
                      </div>
                    )}
                  </div>

                  {/* Multi-lens Camera Switcher */}
                  {cameras.length > 1 && isScanning && (
                    <div className="mt-4 w-full bg-white/70 backdrop-blur-sm p-3 rounded-xl border border-blush-100 flex flex-col gap-1.5 animate-fade-in shadow-sm">
                      <label htmlFor="camera-select" className="text-left text-[11px] font-bold text-text-light">
                        Ganti Lensa Kamera:
                      </label>
                      <select
                        id="camera-select"
                        value={activeCamera?.id || ''}
                        onChange={(e) => startScanner(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-blush-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blush-400 text-text-main cursor-pointer"
                      >
                        {cameras.map((camera) => (
                          <option key={camera.id} value={camera.id}>
                            {camera.label || `Lensa ${camera.id.slice(0, 5)}...`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Button Batal (Mobile-Only, on desktop they see standby option) */}
                  <button
                    onClick={() => {
                      stopScanner();
                      setIsScannerActive(false);
                    }}
                    className="mt-4 md:hidden px-5 py-2 bg-white hover:bg-blush-50 border border-blush-200 text-blush-700 font-bold text-xs rounded-xl transition-all shadow-sm"
                  >
                    Batal Memindai
                  </button>
                </div>

              </div>

              {/* KOLOM KANAN: Content & Results Dashboard */}
              <div className={`w-full mt-6 md:mt-0 ${!isScanning && !isInitializing && !showError ? 'block' : 'hidden md:block'
                }`}>

                {/* 1. Content: Standby Welcome & Instructions */}
                {showInitState && (
                  <div className="w-full glass-card p-6 md:p-8 rounded-3xl text-center md:text-left space-y-6 animate-fade-in border-t-4 border-t-blush-400 shadow-xl">
                    <div className="hidden md:flex justify-start mb-2">
                      <div className="w-14 h-14 bg-blush-100 text-blush-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                        </svg>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl md:text-2xl font-bold text-blush-900 font-serif">Selamat Datang, Panitia!</h2>
                      <p className="text-sm text-text-light leading-relaxed">
                        Gunakan panel scanner ini untuk memverifikasi kedatangan tamu undangan secara real-time. Data check-in akan otomatis disinkronisasikan ke database Google Sheets.
                      </p>
                    </div>

                    <div className="border-t border-blush-100 pt-5 space-y-3">
                      <h4 className="text-xs font-bold text-blush-800 uppercase tracking-wider">Petunjuk Singkat Pengoperasian:</h4>
                      <ol className="text-xs text-text-light space-y-2.5 list-decimal list-inside leading-relaxed">
                        <li>Klik tombol <strong>Mulai Memindai</strong> di bawah atau pada kotak kamera.</li>
                        <li>Izinkan akses kamera jika browser memintanya.</li>
                        <li>Arahkan kamera ke QR Code undangan tamu.</li>
                        <li>Tunggu hasil verifikasi (Sukses / Sudah Check-in / Gagal).</li>
                      </ol>
                    </div>

                    <button
                      onClick={handleStartScan}
                      className="w-full bg-blush-600 hover:bg-blush-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg active:scale-95 text-base text-center"
                    >
                      Mulai Memindai
                    </button>
                  </div>
                )}

                {/* 2. Content: Active Scanning Tips (Desktop-Only Placeholder) */}
                {isScanning && !isInitializing && (
                  <div className="w-full glass-card p-6 md:p-8 rounded-3xl text-center md:text-left space-y-5 animate-fade-in border-t-4 border-t-blush-400 shadow-xl">
                    <div className="hidden md:flex justify-start mb-2">
                      <div className="w-14 h-14 bg-blush-50 text-blush-600 rounded-2xl flex items-center justify-center shadow-inner animate-pulse">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h2M4 8h16M4 16h16M4 4h16"></path>
                        </svg>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl md:text-2xl font-bold text-blush-900 font-serif">Kamera Sedang Aktif</h2>
                      <p className="text-sm text-text-light leading-relaxed">
                        Mencari kode QR... Arahkan kode QR tamu ke depan lensa kamera. Pastikan pencahayaan cukup dan gambar tidak kabur/goyang.
                      </p>
                    </div>

                    <div className="pt-4 border-t border-blush-100 flex flex-col gap-2">
                      <div className="flex items-center justify-center md:justify-start gap-2.5 text-xs text-emerald-600 font-semibold bg-emerald-50 py-2.5 px-4.5 rounded-xl border border-emerald-100/50">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                        Sistem Siap Menerima Data QR
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        stopScanner();
                        setIsScannerActive(false);
                      }}
                      className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-3 px-6 rounded-xl transition-all text-sm"
                    >
                      Batal Memindai
                    </button>
                  </div>
                )}

                {/* 3. Content: API Loading Ticket Spinner */}
                {apiLoading && (
                  <div className="w-full glass-card p-8 rounded-3xl text-center space-y-5 animate-fade-in shadow-xl mt-2">
                    <div className="py-4 flex justify-center">
                      <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-blush-600"></div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-blush-900 text-base md:text-lg font-serif">Memproses Tiket</h3>
                      <p className="text-xs text-text-light">Menghubungkan ke database Google Sheets...</p>
                    </div>
                  </div>
                )}

                {/* 4. Content: Scan Results */}
                {showResultUi && (
                  <div className="w-full glass-card p-6 md:p-8 rounded-3xl text-center md:text-left space-y-6 animate-fade-in shadow-xl border-t-4 border-t-blush-500 bg-white/95">

                    {/* SUCCESS CARD */}
                    {scanResult.result === 'success' && (
                      <div className="space-y-4">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto md:mx-0 shadow-inner">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
                          </svg>
                        </div>
                        <div className="space-y-1 text-center md:text-left">
                          <h2 className="text-2xl font-bold text-emerald-700 font-serif">Check-in Berhasil!</h2>
                          <p className="text-xs text-text-light">Tamu telah terverifikasi masuk ke dalam sistem</p>
                        </div>
                        <div className="bg-emerald-50/50 border border-emerald-100/50 p-5 rounded-2xl space-y-3 shadow-inner">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">Nama Tamu</span>
                            <p className="font-bold text-xl text-slate-800 leading-tight mt-0.5">{decodeStoredGuestName(scanResult.name)}</p>
                          </div>
                          <div className="h-px bg-emerald-100/60"></div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">Jumlah pax</span>
                            <p className="font-bold text-xl text-slate-800 leading-tight mt-0.5">{scanResult.count} Orang</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ALREADY CHECKED IN CARD */}
                    {scanResult.result === 'already_checked_in' && (
                      <div className="space-y-4">
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto md:mx-0 shadow-inner">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                          </svg>
                        </div>
                        <div className="space-y-1 text-center md:text-left">
                          <h2 className="text-2xl font-bold text-amber-700 font-serif">Sudah Check-in!</h2>
                          <p className="text-xs text-text-light">Tiket QR Code ini pernah digunakan sebelumnya</p>
                        </div>
                        <div className="bg-amber-50/50 border border-amber-100/50 p-5 rounded-2xl space-y-3 shadow-inner">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider font-bold text-amber-800">Nama Tamu</span>
                            <p className="font-bold text-xl text-slate-800 leading-tight mt-0.5">{decodeStoredGuestName(scanResult.name)}</p>
                          </div>
                          <div className="h-px bg-amber-100/60"></div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider font-bold text-amber-800">Pax Terdaftar</span>
                            <p className="font-bold text-xl text-slate-800 leading-tight mt-0.5">{scanResult.count} Orang</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ERROR CODE RESULT */}
                    {scanResult.result === 'error' && (
                      <div className="space-y-4">
                        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto md:mx-0 shadow-inner">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        </div>
                        <div className="space-y-1 text-center md:text-left">
                          <h2 className="text-2xl font-bold text-rose-700 font-serif">Pindai Gagal!</h2>
                          <p className="text-sm text-text-light leading-relaxed">
                            {scanResult.message || 'Format QR Code tidak dikenali oleh sistem.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Action button */}
                    <button
                      onClick={handleStartScan}
                      className="w-full bg-blush-600 hover:bg-blush-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md active:scale-95 text-base text-center"
                    >
                      Scan Tamu Lainnya
                    </button>
                  </div>
                )}

              </div>

            </div>
          )}

        </main>

        {/* Footer */}
        <footer className="py-6 text-center text-[10px] text-text-light tracking-wider font-semibold border-t border-blush-100 mt-6 relative z-10">
          Wedding of Lancy & Kiyora • 2026
        </footer>
      </div>
    </div>
  );
}
