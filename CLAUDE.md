# Working in this repository

`README.md` is written for whoever uses or hosts the app: what the teacher does
with it, which browsers work, what it deliberately will not do. Read it before a
first change — the behaviour it describes is the specification. What follows is
only what an agent gets wrong without being told.

## Commits and pull requests

Commit subjects and pull request titles follow
[Conventional Commits](https://www.conventionalcommits.org):

```
feat(labels): give each label a colour and a mascot
fix(photos): keep the EXIF orientation of a portrait photo
docs: explain the label palette
```

- Types in use: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.
- Scopes follow the page or the module: `labels`, `photos`, `filing`, `qr`.
- The subject is English, lower case, imperative, under ~70 characters.
- The body says _why_ before _what_, wrapped at 80 columns. The diff already
  says what changed; a message that only paraphrases it is worth nothing.
- A pull request title obeys the same rule, and its body covers the whole
  branch — not just the commit it was opened from.

## Language

Code is English, the interface is French — the user is a French primary school
teacher. The boundary runs exactly here:

- identifiers, comments, commit messages, test names, HTML `id`s and CSS class
  names are English;
- every string she can read stays French — page copy, button labels,
  `aria-label`s, placeholders, status messages, and the `Sans-nom` fallback that
  ends up in a file name;
- French stays where it is behaviour rather than prose: `<html lang="fr">`,
  `localeCompare(…, 'fr')`, and the French keys `extractFirstName` accepts
  (`prenom=`, `nom=`), because that is what a French label generator emits.

The `localStorage` keys keep the project's old name (`qr-school.names`,
`qr-school.label-options`, `qr-school.size`). They point at data already in the
teacher's browser; renaming them would silently empty her class list.

## Where things live

One module per idea, named after it, and the module boundary follows what a test
can reach: names, file names, numbering, palettes and sheet geometry are plain
functions with no DOM and no disk, and `photos.ts` and `labels.ts` are the only
files that know about elements. Keep it that way — the disk is reached through an
`exists` predicate a test can replace, not through a handle passed down the call
stack.

Never branch on a browser name. What separates Chromium from Firefox and Safari
here is one capability, `showDirectoryPicker`, and `folder-access.ts` is the only
place that asks.

## Before saying it works

```bash
npm run verify   # format:check, lint, typecheck, tests, build, browser tests
```

`npm run verify` is the gate; the CI runs the same thing. Nothing is "done"
until it passes. The browser tests need Chromium once:
`npx playwright install chromium`.

Tests carry the intent, not just the assertion: `photo-reading.test.ts` builds
fake photos by 3D projection because that, not a rotated image, is what a
hand-held photo looks like. Extend that suite rather than weakening it — and if
a test documents a limit that starts passing, that is news to notice, not a
failure to silence.

Anything the DOM does — the worker pool, the pages of the label sheet, writing to
a folder — belongs in `tests/` and needs Chromium; `npm test` cannot see it. When
you add one, break the code on purpose and check that test, and only that test,
goes red. A browser test that has never failed is not known to work.

Those tests drive the **built** site: the worker URL and the `.wasm` path are
rewritten at build time, so a dev-server run would miss exactly the breakage they
exist for. `showDirectoryPicker` opens a native window no test can drive, hence
the two fakes in `tests/fake-folders.ts` — a source drawing its photos from the
same QR matrix the label page uses, and a destination recording what it received.
Nothing binary is committed, and a test label stays one the app would print.
Judging the decoder is not their job; `photo-reading.test.ts` owns that.

Three things no suite here covers, so a change touching them is only ever
verified by hand: the native Windows folder picker, the download fallback for
browsers without folder access, and real camera photos.

## The one constraint that breaks the app silently

**A label the decoder cannot read looks perfectly fine on screen.** Every ink
stays dark: zxing thresholds on brightness alone, so a pastel QR code stops
being decoded while still looking like a QR code. The palettes in
`label-theme.ts` sit under 40 % of the brightness of white, and a colour picked
by hand goes through `readableInk` first.

Anything touching the appearance of a label — colour, module shape, quiet zone,
size, the white patch under the code — is a decoding change. Photograph it in
`photo-reading.test.ts` and check the first name comes back.
