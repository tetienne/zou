import { describe, expect, it } from 'vitest';
import { directoryPicker, supportsFolders, type FolderScope } from './folder-access';

// What the home page shows hangs on this single question, so it is asked of the
// API and not of a list of browser names — nor of the engine behind them, since
// Brave is Chromium and still withholds the picker.
describe('supportsFolders', () => {
  it('accepts a browser exposing the picker', () => {
    const scope: FolderScope = { showDirectoryPicker: () => Promise.reject(new Error('unused')) };
    expect(supportsFolders(scope)).toBe(true);
    expect(directoryPicker(scope)).toBe(scope.showDirectoryPicker);
  });

  it('refuses a browser without the picker, as Firefox and Safari are', () => {
    expect(supportsFolders({})).toBe(false);
    expect(directoryPicker({})).toBeUndefined();
  });

  // Brave ships Chromium and blocks the File System Access API all the same, so
  // the page must not read anything into the engine — and must not send the
  // teacher to a browser that will greet her with the very same warning.
  it('refuses a Chromium browser that withholds the picker, as Brave does', () => {
    const brave = { chrome: {}, navigator: { brave: {} } } as unknown as FolderScope;
    expect(supportsFolders(brave)).toBe(false);
    expect(directoryPicker(brave)).toBeUndefined();
  });

  // A stub left on `window` by an extension must not pass for the real thing:
  // the page would offer a destination folder it cannot write into.
  it('refuses a picker that cannot be called', () => {
    const scope = { showDirectoryPicker: 'yes' } as unknown as FolderScope;
    expect(supportsFolders(scope)).toBe(false);
    expect(directoryPicker(scope)).toBeUndefined();
  });
});
