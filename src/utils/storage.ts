import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const useSecure = Platform.OS !== 'web';

export async function storageGet(key: string): Promise<string | null> {
  try {
    const asyncVal = await AsyncStorage.getItem(key);
    if (asyncVal !== null) return asyncVal;
  } catch { }
  if (useSecure) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch { }
  }
  return null;
}

export async function storageSet(key: string, value: string): Promise<void> {
  // SecureStore on Android has a 2048-byte limit. For photos or offline queues,
  // save in AsyncStorage. For tokens, use SecureStore.
  if (useSecure && value.length < 1500) {
    try {
      await SecureStore.setItemAsync(key, value);
      await AsyncStorage.removeItem(key).catch(() => { });
      return;
    } catch {
      // Fallback to AsyncStorage if SecureStore fails
    }
  }
  await AsyncStorage.setItem(key, value);
}

export async function storageDelete(key: string): Promise<void> {
  await AsyncStorage.removeItem(key).catch(() => { });
  if (useSecure) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch { }
  }
}
