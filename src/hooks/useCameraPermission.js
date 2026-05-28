import { useState, useEffect, useCallback } from 'react';

/**
 * Custom Hook untuk mengelola status permission kamera
 */
export default function useCameraPermission() {
  const [permissionState, setPermissionState] = useState('loading'); // 'loading', 'granted', 'denied', 'prompt'

  const checkPermission = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return 'denied';
    }

    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'camera' });
        return status.state;
      }
    } catch (e) {
      console.warn('navigator.permissions.query camera not supported on this browser:', e);
    }

    return 'prompt';
  }, []);

  const requestPermission = useCallback(async () => {
    setPermissionState('loading');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionState('granted');
      return true;
    } catch (error) {
      console.error('Camera permission request error:', error);
      setPermissionState('denied');
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const runCheck = async () => {
      const state = await checkPermission();
      if (isMounted) {
        setPermissionState(state);
      }
    };

    runCheck();

    // Setup permission change listener if supported
    let statusObj = null;
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' })
        .then((status) => {
          if (!isMounted) return;
          statusObj = status;
          status.onchange = () => {
            if (isMounted) {
              setPermissionState(status.state);
            }
          };
        })
        .catch((err) => {
          console.warn('Permissions query check failed:', err);
        });
    }

    return () => {
      isMounted = false;
      if (statusObj) {
        statusObj.onchange = null;
      }
    };
  }, [checkPermission]);

  return {
    permissionState,
    requestPermission,
    checkPermission,
  };
}
