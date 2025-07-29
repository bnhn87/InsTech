/**
 * Simple offline storage helpers for the web app.  These functions use
 * `localStorage` to persist data when the user is offline.  You can
 * replace this with IndexedDB or another storage mechanism as needed.
 */

export function saveOffline(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // localStorage may be unavailable or quota exceeded
    console.warn('Failed to save offline data', e);
  }
}

export function loadOffline<T = any>(key: string): T | null {
  const data = localStorage.getItem(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export function removeOffline(key: string) {
  localStorage.removeItem(key);
}