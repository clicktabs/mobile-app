import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const useSecure = Platform.OS !== 'web';

export async function storageGet(key: string): Promise<string | null> {
  if (useSecure) return SecureStore.getItemAsync(key);
  return AsyncStorage.getItem(key);
}

export async function storageSet(key: string, value: string): Promise<void> {
  if (useSecure) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

export async function storageDelete(key: string): Promise<void> {
  if (useSecure) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}
