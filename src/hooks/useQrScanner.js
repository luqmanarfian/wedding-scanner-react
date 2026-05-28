import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { SCANNER_CONFIG, SCANNER_ERRORS } from '../constants/scanner';
import {
  checkIsSecureContext,
  getAvailableCameras,
  findBestRearCamera,
} from '../services/cameraService';

/**
 * Menerjemahkan error MediaDevices ke format internal SCANNER_ERRORS
 */
function classifyError(error) {
  if (!error) return SCANNER_ERRORS.INITIALIZATION_ERROR;
  
  const errStr = String(error).toLowerCase();
  
  if (errStr.includes('notallowederror') || errStr.includes('permission denied')) {
    return SCANNER_ERRORS.PERMISSION_DENIED;
  }
  if (
    errStr.includes('notreadableerror') || 
    errStr.includes('could not start video source') || 
    errStr.includes('in use') ||
    errStr.includes('concurrent')
  ) {
    return SCANNER_ERRORS.IN_USE;
  }
  if (errStr.includes('notfounderror') || errStr.includes('no video input devices found')) {
    return SCANNER_ERRORS.NOT_FOUND;
  }
  
  return SCANNER_ERRORS.INITIALIZATION_ERROR;
}

/**
 * Custom Hook untuk mengontrol Html5Qrcode secara deklaratif
 * @param {string} elementId - ID DOM element penampung scanner
 * @param {Function} onScanSuccess - Callback ketika QR berhasil ter-scan
 */
export default function useQrScanner(elementId, onScanSuccess) {
  const [cameras, setCameras] = useState([]);
  const [activeCamera, setActiveCamera] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);

  const html5QrCodeRef = useRef(null);
  const onScanSuccessRef = useRef(onScanSuccess);
  
  // Guard synchronous untuk StrictMode / double trigger
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);

  // Selalu simpan callback terbaru agar tidak merusak memoization startScanner
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  /**
   * Menghentikan scanner dan camera stream secara bersih
   */
  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    if (html5QrCodeRef.current) {
      const canStop = html5QrCodeRef.current.isScanning || 
                      (typeof html5QrCodeRef.current.getState === 'function' && html5QrCodeRef.current.getState() === 2);
                      
      if (canStop) {
        try {
          await html5QrCodeRef.current.stop();
          console.log('Scanner stopped successfully');
        } catch (err) {
          // Abaikan error transisi state yang wajar terjadi saat StrictMode/overlap
          console.warn('Silently caught camera stop error:', err.message || err);
        }
      } else {
        try {
          html5QrCodeRef.current.clear();
        } catch {
          // Ignore clear errors if it's already cleared
        }
      }
      html5QrCodeRef.current = null;
    }
    
    // PENTING: Hancurkan video element sisa di DOM agar tidak bertumpuk/membeku di layar
    const container = document.getElementById(elementId);
    if (container) {
      container.innerHTML = '';
    }
    
    setIsScanning(false);
    setActiveCamera(null);
    isStoppingRef.current = false;
  }, [elementId]);

  /**
   * Memulai scanner dengan strategi fallback bertingkat
   */
  const startScanner = useCallback(async (cameraId = null) => {
    // 1. Guard jika inisialisasi sedang berjalan (mencegah overlapping async calls)
    if (isStartingRef.current) {
      console.log('Scanner initialization is already in progress. Skipping...');
      return;
    }
    isStartingRef.current = true;
    setError(null);
    setIsInitializing(true);

    try {
      // 2. Cek Secure Context (HTTPS/localhost)
      if (!checkIsSecureContext()) {
        setError(SCANNER_ERRORS.NOT_SECURE);
        setIsInitializing(false);
        isStartingRef.current = false;
        return;
      }

      // 3. Teardown jika sebelumnya ada instance berjalan
      await stopScanner();
      // Beri waktu browser untuk melepas hardware kamera sepenuhnya
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 4. Ambil list kamera
      const devices = await getAvailableCameras();
      setCameras(devices);

      if (devices.length === 0) {
        setError(SCANNER_ERRORS.NOT_FOUND);
        setIsInitializing(false);
        isStartingRef.current = false;
        return;
      }

      // 5. Pastikan element container ada dan bersih dari tag video lama
      const container = document.getElementById(elementId);
      if (!container) {
        throw new Error(`Element #${elementId} not found in DOM`);
      }
      
      // Kosongkan container DOM sebelum inisialisasi agar video tags tidak terduplikasi
      container.innerHTML = '';
      
      // Instance akan dibuat di dalam loop untuk setiap percobaan
      // 6. Susun fallback strategy pipeline
      const bestRear = findBestRearCamera(devices);
      const fallbackSequence = [];

      // Prioritas 1: Kamera pilihan user dari UI dropdown
      if (cameraId) {
        fallbackSequence.push({ target: cameraId, type: 'id' });
      }
      
      // Prioritas 2: Kamera belakang terbaik yang terdeteksi
      if (bestRear && bestRear.id !== cameraId) {
        fallbackSequence.push({ target: bestRear.id, type: 'id' });
      }
      
      // Prioritas 3: Environment facingMode (Android / iOS standard)
      fallbackSequence.push({ target: { facingMode: 'environment' }, type: 'facingMode' });
      
      // Prioritas 4: User facingMode (kamera depan jika kamera belakang mati)
      fallbackSequence.push({ target: { facingMode: 'user' }, type: 'facingMode' });
      
      // Prioritas 5: Kamera pertama di list device
      if (devices.length > 0 && (!bestRear || devices[0].id !== bestRear.id) && devices[0].id !== cameraId) {
        fallbackSequence.push({ target: devices[0].id, type: 'id' });
      }

      // 7. Jalankan run loop untuk mencoba membuka kamera
      let isStarted = false;
      let lastError = null;

      // Config scanner
      const config = {
        fps: SCANNER_CONFIG.FPS,
        qrbox: (width, height) => {
          const minDimension = Math.min(width, height);
          const qrboxSize = Math.max(50, Math.floor(minDimension * SCANNER_CONFIG.QR_BOX_RATIO));
          return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: 1.0,
      };

      for (const step of fallbackSequence) {
        try {
          if (!html5QrCodeRef.current) {
            container.innerHTML = '';
            html5QrCodeRef.current = new Html5Qrcode(elementId);
          }
          
          console.log(`Starting camera attempt with target:`, step.target);
          await html5QrCodeRef.current.start(
            step.target,
            config,
            (decodedText, decodedResult) => {
              if (onScanSuccessRef.current) {
                onScanSuccessRef.current(decodedText, decodedResult);
              }
            },
            () => {
              // Ignore error scanning per-frame
            }
          );

          isStarted = true;
          setIsScanning(true);

          // Update active camera state
          if (step.type === 'id') {
            const matched = devices.find((d) => d.id === step.target);
            setActiveCamera(matched || { id: step.target, label: 'Kamera Terpilih' });
          } else {
            setActiveCamera(bestRear || devices[0] || { id: 'default', label: 'Default Camera' });
          }

          console.log('Camera started successfully.');
          break; // Berhasil membuka kamera, keluar dari loop fallback
        } catch (err) {
          console.warn(`Camera attempt failed with target:`, step.target, err);
          lastError = err;
          
          // Clean up corrupted instance so next iteration creates a fresh one
          if (html5QrCodeRef.current) {
            try {
              if (html5QrCodeRef.current.isScanning) {
                await html5QrCodeRef.current.stop();
              } else {
                html5QrCodeRef.current.clear();
              }
            } catch (e) {
              console.warn('Error during corrupted instance cleanup:', e);
            }
            html5QrCodeRef.current = null;
          }
        }
      }

      if (!isStarted) {
        const internalError = classifyError(lastError);
        setError(internalError);
        html5QrCodeRef.current = null;
      }
    } catch (err) {
      console.error('Unexpected error in startScanner:', err);
      setError(SCANNER_ERRORS.INITIALIZATION_ERROR);
    } finally {
      setIsInitializing(false);
      isStartingRef.current = false;
    }
  }, [elementId, stopScanner]);

  // Pause API (bermanfaat ketika memproses scan agar screen tidak freeze)
  const pauseScanner = useCallback(() => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      html5QrCodeRef.current.pause(true);
    }
  }, []);

  // Cleanup effect saat hook unmount
  useEffect(() => {
    return () => {
      // Gunakan stopScanner yang sudah aman dari race-condition
      stopScanner().catch(() => {});
    };
  }, [stopScanner]);

  return {
    cameras,
    activeCamera,
    isInitializing,
    isScanning,
    error,
    startScanner,
    stopScanner,
    pauseScanner,
  };
}
