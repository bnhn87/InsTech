import { loadOffline, removeOffline, saveOffline } from './offline';
import { supabase } from './supabaseClient';

// Sync offline pins saved under the key 'offline_pins'.
// Each entry should be of the form { projectId, floorPlanId, pinRows }
export async function syncOfflinePins() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const entries = loadOffline<any[]>('offline_pins') || [];
  if (!entries.length) return;
  
  const successfulEntries: any[] = [];
  
  for (const entry of entries) {
    try {
      const { pinRows } = entry;
      if (pinRows && pinRows.length > 0) {
        const { error } = await supabase.from('pins').insert(pinRows);
        if (!error) {
          successfulEntries.push(entry);
        }
      }
    } catch (error) {
      console.error('Failed to sync pin entry:', error);
    }
  }
  
  if (successfulEntries.length > 0) {
    const remainingEntries = entries.filter(entry => !successfulEntries.includes(entry));
    if (remainingEntries.length > 0) {
      saveOffline('offline_pins', remainingEntries);
    } else {
      removeOffline('offline_pins');
    }
  }
}

// Sync offline form responses saved under 'offline_forms'
export async function syncOfflineForms() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const entries = loadOffline<any[]>('offline_forms') || [];
  if (!entries.length) return;
  
  const successfulEntries: any[] = [];
  
  for (const resp of entries) {
    try {
      const { error } = await supabase.from('form_responses').insert(resp);
      if (!error) {
        successfulEntries.push(resp);
      }
    } catch (error) {
      console.error('Failed to sync form response:', error);
    }
  }
  
  if (successfulEntries.length > 0) {
    const remainingEntries = entries.filter(entry => !successfulEntries.includes(entry));
    if (remainingEntries.length > 0) {
      saveOffline('offline_forms', remainingEntries);
    } else {
      removeOffline('offline_forms');
    }
  }
}
