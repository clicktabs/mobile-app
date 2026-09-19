import { Platform } from 'react-native';

const PRODUCTION_URL = 'https://click-tabs.com';

/**
 * Android emulator reaches host machine via 10.0.2.2 in local dev.
 * In release mode or when EXPO_PUBLIC_API_URL is configured, production endpoint is used.
 */
const DEV_HOST =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000';

const DEFAULT_HOST = __DEV__ ? DEV_HOST : PRODUCTION_URL;

/** The server itself, without the /api suffix — what a browser link needs. */
export const WEB_BASE_URL =
  (process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || DEFAULT_HOST).replace(/\/$/, '');

export const API_BASE_URL = `${WEB_BASE_URL}/api`;

export const APP_NAME = 'Click Tabs';
