import { isCloudMode } from '$lib/supabase/config';

export type SyncStatus = 'local' | 'connecting' | 'live' | 'offline' | 'error';

/**
 * Reactive view of the data layer's connection, for the UI. `remoteVersion`
 * ticks whenever someone else's change lands, so views can offer (or perform)
 * a refresh instead of silently showing stale data.
 */
class SyncState {
  mode = $state<'local' | 'cloud'>(isCloudMode ? 'cloud' : 'local');
  status = $state<SyncStatus>(isCloudMode ? 'connecting' : 'local');
  error = $state('');
  remoteVersion = $state(0);
  /** Collections changed remotely since the view last refreshed. */
  pendingCollections = $state<string[]>([]);

  markRemoteChange(key: string) {
    this.remoteVersion++;
    if (!this.pendingCollections.includes(key)) {
      this.pendingCollections = [...this.pendingCollections, key];
    }
  }

  acknowledge() {
    this.pendingCollections = [];
  }
}

export const syncState = new SyncState();
