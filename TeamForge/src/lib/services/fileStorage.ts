import { isCloudMode, FILES_BUCKET } from '$lib/supabase/config';

/*
  File bytes live in IndexedDB in local mode and in Supabase Storage (bucket
  `project-files`, path `files/<id>`) in cloud mode. Callers use the same three
  functions either way.
*/

const objectPath = (id: string) => `files/${id}`;

async function bucket() {
  const { getSupabase } = await import('$lib/supabase/client');
  return (await getSupabase()).storage.from(FILES_BUCKET);
}

const DB_NAME = 'teamforge_file_blobs';
const STORE_NAME = 'blobs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Stores the raw file bytes for a ProjectFile record, keyed by its id. */
export async function storeFileBlob(id: string, blob: Blob): Promise<void> {
  if (isCloudMode) {
    const { flushWrites } = await import('$lib/services/cloudSync');
    // The storage policy only accepts bytes for a file whose `files` row
    // already exists, so let that write land first.
    await flushWrites();
    const { error } = await (await bucket()).upload(objectPath(id), blob, {
      contentType: blob.type || 'application/octet-stream',
      upsert: false
    });
    if (error) throw error;
    return;
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFileBlob(id: string): Promise<Blob | undefined> {
  if (isCloudMode) {
    const { data, error } = await (await bucket()).download(objectPath(id));
    if (error) {
      // A seeded demo file has a record but no bytes.
      if (/not.?found|404/i.test(`${error.message} ${(error as { statusCode?: string }).statusCode ?? ''}`)) return undefined;
      throw error;
    }
    return data ?? undefined;
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFileBlob(id: string): Promise<void> {
  if (isCloudMode) {
    await (await bucket()).remove([objectPath(id)]);
    return;
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function inferFileCategory(file: File): 'pdf' | 'image' | 'doc' | 'code' | 'other' {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  if (/\.(doc|docx|ppt|pptx|xls|xlsx|odt)$/.test(name)) return 'doc';
  if (/\.(js|ts|jsx|tsx|py|java|c|cpp|go|rs|svelte|html|css|json|md)$/.test(name)) return 'code';
  return 'other';
}
