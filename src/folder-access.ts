// Can the browser write straight into a folder the teacher picks?
//
// Chrome and Edge have done it since 2021 through the File System Access API.
// Firefox and Safari do not, and fall back to one download per photo — but so do
// browsers no list would think to exclude: Brave withholds the picker on purpose
// though it is Chromium, and every browser on a phone or a tablet lacks it.
//
// The pages therefore ask the API instead of naming browsers. Being Chromium
// predicts nothing, a list of names is wrong the moment a fork changes its mind,
// and it is the wrong question to put to the teacher, who should not have to
// know which engine she is running.

// --- File System Access API -------------------------------------------------
// Not typed by lib.dom, so we describe only what we use.

export interface PickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
}
export type DirectoryPicker = (options?: PickerOptions) => Promise<Directory>;

export interface Directory {
  readonly name: string;
  // Chromium only, and absent on a handle that predates them: a folder kept
  // from one week to the next is asked whether it may still be read.
  queryPermission?(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  values(): AsyncIterable<{ kind: string; name: string; getFile(): Promise<File> }>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<Directory>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

/** Only the part of `window` this module looks at, so a test can fake it. */
export interface FolderScope {
  showDirectoryPicker?: DirectoryPicker;
}

const currentScope = (): FolderScope => globalThis as unknown as FolderScope;

/** The folder picker, or `undefined` where the browser has none. */
export function directoryPicker(scope: FolderScope = currentScope()): DirectoryPicker | undefined {
  return typeof scope.showDirectoryPicker === 'function' ? scope.showDirectoryPicker : undefined;
}

/** True where photos can be written into a chosen folder rather than downloaded. */
export function supportsFolders(scope: FolderScope = currentScope()): boolean {
  return directoryPicker(scope) !== undefined;
}
