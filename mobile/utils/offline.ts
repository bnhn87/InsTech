import AsyncStorage from '@react-native-async-storage/async-storage';

export async function saveOffline(key: string, value: any) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Failed to save offline data', e);
  }
}

export async function loadOffline<T = any>(key: string): Promise<T | null> {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? (JSON.parse(data) as T) : null;
  } catch {
    return null;
  }
}

export async function removeOffline(key: string) {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}