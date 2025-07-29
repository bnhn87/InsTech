import { loadOffline, removeOffline } from './offline';
import { supabase } from './supabaseClient';

// Sync offline pins saved under the key 'offline_pins'.
// Each entry should be of the form { projectId, floorPlanId, pinRows }
export async function syncOfflinePins() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const entries = loadOffline<any[]>('offline_pins') || [];
  if (!entries.length) return;
  for (const entry of entries) {
    try {
      const { pinRows } = entry;
      if (pinRows && pinRows.length > 0) {
        const { error } = await supabase.from('pins').insert(pinRows);
        if (!error) {
          // remove entry if successful
          // continue
        }
      }
    } catch {}
  }
  removeOffline('offline_pins');
}

// Sync offline form responses saved under 'offline_forms'
export async function syncOfflineForms() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const entries = loadOffline<any[]>('offline_forms') || [];
  if (!entries.length) return;
  for (const resp of entries) {
    try {
      const { error } = await supabase.from('form_responses').insert(resp);
      if (!error) {
        // success
      }
    } catch {}
  }
  removeOffline('offline_forms');
}