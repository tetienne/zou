import { describe, expect, it } from 'vitest';
import { directoryPicker, supportsFolders, type FolderScope } from './folder-access';

// What the home page shows hangs on this single question, so it is asked of the
// API and not of a list of browser names.
describe('supportsFolders', () => {
  it('accepts a browser exposing the picker', () => {
    const scope: FolderScope = { showDirectoryPicker: () => Promise.reject(new Error('unused')) };
    expect(supportsFolders(scope)).toBe(true);
    expect(directoryPicker(scope)).toBe(scope.showDirectoryPicker);
  });

  // Firefox and Safari, but Brave too: it ships Chromium and turns the API off,
  // so nothing can be read off the engine either.
  it('refuses a browser without the picker', () => {
    expect(supportsFolders({})).toBe(false);
    expect(directoryPicker({})).toBeUndefined();
  });

  // A stub left on `window` by an extension must not pass for the real thing:
  // the page would offer a destination folder it cannot write into.
  it('refuses a picker that cannot be called', () => {
    const scope = { showDirectoryPicker: 'yes' } as unknown as FolderScope;
    expect(supportsFolders(scope)).toBe(false);
    expect(directoryPicker(scope)).toBeUndefined();
  });
});
