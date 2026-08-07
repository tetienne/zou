import { describe, expect, it } from 'vitest';
import { grantAccess, reuseState } from './folder-memory';
import type { Directory } from './folder-access';

// A remembered folder is only ever half a folder: the handle comes back from
// IndexedDB, the permission does not. These tests cover the decision the page
// makes with it — the IndexedDB half needs a browser and is checked by hand.

type PermissionAnswer = PermissionState | Error;

function folder(query?: PermissionAnswer, request?: PermissionAnswer): Directory {
  const answer = (value: PermissionAnswer) => () =>
    value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

  return {
    name: 'Photos',
    ...(query === undefined ? {} : { queryPermission: answer(query) }),
    ...(request === undefined ? {} : { requestPermission: answer(request) }),
  } as Directory;
}

describe('reuseState', () => {
  it('reuses a folder the browser still lets us read', async () => {
    expect(await reuseState(folder('granted'), 'read')).toBe('ready');
  });

  it('asks again when the permission lapsed with the session', async () => {
    expect(await reuseState(folder('prompt'), 'read')).toBe('ask');
  });

  it('gives up on a folder she refused', async () => {
    expect(await reuseState(folder('denied'), 'readwrite')).toBe('lost');
  });

  // The SD card is unplugged, or the folder was renamed between two Fridays.
  it('gives up when the handle leads nowhere', async () => {
    expect(await reuseState(folder(new Error('NotFoundError')), 'read')).toBe('lost');
  });

  // A handle stored by an older browser has no permission methods at all.
  it('falls back to asking when the browser cannot answer', async () => {
    expect(await reuseState(folder(), 'read')).toBe('ask');
  });
});

describe('grantAccess', () => {
  it('does not ask twice for a folder already granted', async () => {
    let asked = false;
    const already = folder('granted');
    already.requestPermission = () => {
      asked = true;
      return Promise.resolve<PermissionState>('granted');
    };
    expect(await grantAccess(already, 'read')).toBe(true);
    expect(asked).toBe(false);
  });

  it('asks her, and takes yes for an answer', async () => {
    expect(await grantAccess(folder('prompt', 'granted'), 'readwrite')).toBe(true);
  });

  it('takes no for an answer', async () => {
    expect(await grantAccess(folder('prompt', 'denied'), 'readwrite')).toBe(false);
  });

  // Chromium rejects `requestPermission` outside a click; the page must not
  // then behave as though the folder were open.
  it('refuses when the browser rejects the request', async () => {
    expect(await grantAccess(folder('prompt', new Error('needs a gesture')), 'read')).toBe(false);
  });

  it('does not bother asking for a folder that is gone', async () => {
    let asked = false;
    const gone = folder('denied');
    gone.requestPermission = () => {
      asked = true;
      return Promise.resolve<PermissionState>('granted');
    };
    expect(await grantAccess(gone, 'read')).toBe(false);
    expect(asked).toBe(false);
  });
});
