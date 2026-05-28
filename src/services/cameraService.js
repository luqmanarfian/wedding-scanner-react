import { Html5Qrcode } from 'html5-qrcode';

/**
 * Cek apakah halaman berjalan di secure context (HTTPS / Localhost)
 * @returns {boolean}
 */
export function checkIsSecureContext() {
  return window.isSecureContext !== false;
}

/**
 * Mengambil daftar kamera yang tersedia di perangkat
 * @returns {Promise<Array<{id: string, label: string}>>}
 */
export async function getAvailableCameras() {
  try {
    const devices = await Html5Qrcode.getCameras();
    return devices || [];
  } catch (error) {
    console.error('Error fetching cameras via Html5Qrcode:', error);
    // Coba fallback native enumerateDevices jika html5-qrcode bermasalah
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices
          .filter((device) => device.kind === 'videoinput')
          .map((device) => ({
            id: device.deviceId,
            label: device.label || `Kamera ${device.deviceId.slice(0, 4)}`,
          }));
      }
    } catch (fallbackError) {
      console.error('Fallback camera fetching failed:', fallbackError);
    }
    return [];
  }
}

/**
 * Memilih kamera belakang terbaik dari daftar kamera
 * @param {Array<{id: string, label: string}>} devices 
 * @returns {{id: string, label: string} | null}
 */
export function findBestRearCamera(devices) {
  if (!devices || devices.length === 0) return null;

  // Kata kunci penanda kamera belakang pada berbagai browser/device OS
  const rearKeywords = ['back', 'rear', 'environment', 'camerax', 'main', 'outer', 'belakang', '0, back'];

  const rearDevices = devices.filter((device) => {
    const label = (device.label || '').toLowerCase();
    return rearKeywords.some((keyword) => label.includes(keyword));
  });

  if (rearDevices.length > 0) {
    // Pada beberapa device Android, lensa ultra-wide di-detect sebagai kamera belakang pertama.
    // Biasanya lensa utama memiliki label "0, back" atau "main" atau tidak mengandung kata "ultra-wide" / "wide-angle".
    const primaryRear = rearDevices.find(
      (device) => 
        !device.label.toLowerCase().includes('ultra') && 
        !device.label.toLowerCase().includes('wide')
    );
    return primaryRear || rearDevices[0];
  }

  // Jika tidak ditemukan label spesifik tapi ada lebih dari 1 kamera:
  // Biasanya kamera terakhir atau kedua adalah kamera belakang.
  if (devices.length > 1) {
    return devices[devices.length - 1];
  }

  return devices[0];
}
