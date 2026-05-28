export const GOOGLE_SHEETS_URL = import.meta.env.VITE_API_URL;

/**
 * Panggil API Google Sheets untuk check-in via QR Code
 * @param {string} qrId - QR Code ID
 * @returns {Promise<Object>} Response dari server
 */
export async function scanQrCode(qrId) {
  try {
    const url = `${GOOGLE_SHEETS_URL}?qrId=${encodeURIComponent(qrId)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Scan error:', error);
    return {
      result: 'error',
      message: 'Gagal terhubung ke server. Periksa koneksi internet Anda.'
    };
  }
}
