import { Platform } from 'react-native';

/**
 * Android emulator reaches host machine via 10.0.2.2.
 * Physical device: set EXPO_PUBLIC_API_URL to your machine LAN IP.
 */
const DEFAULT_HOST =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000';

export const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || DEFAULT_HOST) + '/api';

export const APP_NAME = 'Click Tabs';
