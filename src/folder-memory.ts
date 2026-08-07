// The two folders the teacher picks again every week.
//
// A directory handle is a live object rather than a path: `localStorage` only
// holds strings, IndexedDB holds the handle itself. What does not survive is
// the permission — the browser hands the page back a handle it may no longer
// read — and `requestPermission` is only answered from inside a click. So the
// page offers the folder back and she takes it, rather than the folder
// silently reappearing.

import type { Directory } from './folder-access';

const DB_NAME = 'zou';
const DB_VERSION = 1;
const STORE = 'folders';

export type FolderSlot = 'source' | 'destination';
export type FolderMode = 'read' | 'readwrite';

/** What a remembered folder is worth: usable, one click away, or gone. */
export type Reuse = 'ready' | 'ask' | 'lost';

export async function reuseState(folder: Directory, mode: FolderMode): Promise<Reuse> {
  if (!folder.queryPermission) return 'ask';
  try {
    const state = await folder.queryPermission({ mode });
    if (state === 'granted') return 'ready';
    return state === 'denied' ? 'lost' : 'ask';
  } catch {
    // Folder moved, renamed, or the card unplugged: the handle leads nowhere.
    return 'lost';
  }
}

/** True once the folder may be read or written. Call it from a click. */
export async function grantAccess(folder: Directory, mode: FolderMode): Promise<boolean> {
  const state = await reuseState(folder, mode);
  if (state === 'ready') return true;
  if (state === 'lost' || !folder.requestPermission) return false;
  try {
    return (await folder.requestPermission({ mode })) === 'granted';
  } catch {
    return false;
  }
}

// --- The store --------------------------------------------------------------
// Untested: `npm test` runs on node, which has no IndexedDB. Checked by hand.

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB refused to open'));
    };
  });
}

function run<T>(database: IDBDatabase, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    const request = act(transaction.objectStore(STORE));
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB refused the operation'));
    };
  });
}

/**
 * Never throws: forgetting a folder costs one extra click, and a browser in
 * private mode or with storage turned off must not take the page down with it.
 */
export async function rememberFolder(slot: FolderSlot, folder: Directory): Promise<void> {
  try {
    const database = await openDatabase(indexedDB);
    await run(database, (store) => store.put(folder, slot));
    database.close();
  } catch {
    /* the page works without memory */
  }
}

export async function recallFolder(slot: FolderSlot): Promise<Directory | null> {
  try {
    const database = await openDatabase(indexedDB);
    const folder = await run<unknown>(database, (store) => store.get(slot));
    database.close();
    return folder && typeof folder === 'object' ? (folder as Directory) : null;
  } catch {
    return null;
  }
}

export async function forgetFolder(slot: FolderSlot): Promise<void> {
  try {
    const database = await openDatabase(indexedDB);
    await run(database, (store) => store.delete(slot));
    database.close();
  } catch {
    /* nothing to forget */
  }
}
