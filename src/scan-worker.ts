// One photo at a time, off the page's thread. `photo-scanning.ts` runs one of
// these per core and never sends a second photo before the first comes back,
// which is why the protocol carries no request id.

import { readPhoto } from './photo-reading';

export interface ScanRequest {
  file: Blob;
}

export type ScanReply = { ok: true; text: string; thumbnail: Blob } | { ok: false };

// `self` is typed as a `Window` here, because the page and the worker share one
// `tsconfig` and therefore one `lib`. Rather than fight it, we describe the
// handful of members a worker actually uses — the same treatment the File
// System Access API gets in `photos.ts`.
const scope = self as unknown as {
  addEventListener(type: 'message', listener: (event: MessageEvent<ScanRequest>) => void): void;
  postMessage(message: ScanReply): void;
};

scope.addEventListener('message', (event) => {
  void readPhoto(event.data.file).then(
    ({ text, thumbnail }) => {
      scope.postMessage({ ok: true, text, thumbnail });
    },
    // A photo the browser cannot decode is an outcome, not a crash: the page
    // shows it as unreadable and the teacher types the name herself.
    () => {
      scope.postMessage({ ok: false });
    },
  );
});
