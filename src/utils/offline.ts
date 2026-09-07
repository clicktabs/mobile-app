import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScheduleItem } from '../types';

const OFFLINE_FLAG = 'ct_work_offline';
const OFFLINE_VISITS = 'ct_offline_visits';
const OFFLINE_AT = 'ct_offline_visits_at';

export async function getWorkOffline(): Promise<boolean> {
  return (await AsyncStorage.getItem(OFFLINE_FLAG)) === '1';
}

export async function setWorkOffline(value: boolean) {
  await AsyncStorage.setItem(OFFLINE_FLAG, value ? '1' : '0');
}

export async function saveOfflineVisits(visits: ScheduleItem[]) {
  await AsyncStorage.setItem(OFFLINE_VISITS, JSON.stringify(visits));
  await AsyncStorage.setItem(OFFLINE_AT, new Date().toISOString());
}

export async function loadOfflineVisits(): Promise<{ visits: ScheduleItem[]; at: string | null }> {
  const raw = await AsyncStorage.getItem(OFFLINE_VISITS);
  const at = await AsyncStorage.getItem(OFFLINE_AT);
  return { visits: raw ? JSON.parse(raw) : [], at };
}
