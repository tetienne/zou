# qr-school — filing pupils' artwork photos by QR code

A small web app that automatically files photos of pupils' work. The teacher
puts a QR label carrying the child's first name next to the work, photographs
the two together, and the app reads the QR code back to copy each photo as
`Prénom_date_numéro.jpg` into a per-child subfolder.

**Nothing to install. No command line. Nothing leaves the computer: all the
processing happens in the browser.**

The interface is in French because the user is a French primary school teacher.
Everything else — code, identifiers, comments, tests, this file — is in English.

---

## Why a web page rather than Python or Go

The binding constraint is "one teacher, one Windows PC, no command line". That
is what picks the technology:

|               | Python                                                | Go                      | **Static page (TypeScript)**                |
| ------------- | ----------------------------------------------------- | ----------------------- | ------------------------------------------- |
| Installation  | Python plus deps, or a 60–150 MB PyInstaller `.exe`   | a ~10 MB `.exe` to copy | **nothing, a bookmark**                     |
| Launching     | double-click an `.exe` → SmartScreen / antivirus warn | same                    | **click the bookmark**                      |
| Updating      | ship a new `.exe` for every fix                       | same                    | **`git push`, she reloads the page**        |
| Hosting       | —                                                     | —                       | **GitHub Pages, free**                      |
| QR decoding   | pyzbar / OpenCV                                       | gozxing                 | zxing-wasm (WebAssembly build of zxing-cpp) |
| Writing files | unrestricted                                          | unrestricted            | folder the user picks (Chromium browsers)   |

The only real advantage of Python or Go would be unrestricted disk access — and
Chromium has been able to do that since 2021 through the **File System Access**
API: the user picks a folder and the browser writes into it. That is exactly
what is needed here, with no local server and no executable to get past the
school's antivirus.

Two points settled it:

- **No OCR.** The first name is not read off the label, it is _inside_ the QR
  code. The most fragile part of the project disappears entirely — no Tesseract,
  no vision model.
- **No maintenance on the machine.** No executable to redeploy, no stale version
  sitting on the classroom PC.

**When should this be revisited?** If HEIC photos (iPhone) have to be handled,
or thousands of photos at a time, or the machine is locked down to Firefox, then
a single Go binary serving the same interface on `localhost` becomes the right
plan B. Most of this code would carry over.

---

## Deployment (once)

1. Push this repository to GitHub.
2. `Settings` → `Pages` → _Source_: **GitHub Actions**.
3. `.github/workflows/deploy.yml` does the rest: on every push to `main` it
   checks types, runs the tests, builds the site and publishes it. Pull requests
   run the same checks without deploying.
4. A minute later the site is at `https://<user>.github.io/qr-school/`.
5. Send that address to the teacher and have her bookmark it on the desktop.

The base path is derived from the repository name (`VITE_BASE`); locally
`npm run dev` serves from the root. HTTPS is mandatory — the folder access API
does not work over `file://` — and GitHub Pages provides it out of the box.

### Trying a branch on the real site, without merging

In the **Actions** tab: _Verify and deploy_ → _Run workflow_ → pick the branch.
The deploy job runs for anything that is not a pull request, so a manual run
publishes whatever branch you select. Pull requests never deploy on their own.

Two things to know before doing it:

- There is a **single Pages site**, so publishing a branch replaces whatever is
  online — including for the teacher, once she has the address.
- GitHub gates it independently of the workflow: the `github-pages` environment
  only accepts the default branch until the branch is allowed under
  `Settings` → `Environments` → `github-pages` → _Deployment branches and tags_.
  Without that the job fails with "Branch is not allowed to deploy to
  github-pages".

One trap worth remembering, because it cost a detour: the _Run workflow_ button
only appears for workflows that **already exist on the default branch**, and the
REST endpoint behaves the same. While this workflow lived only on a feature
branch there was no way to trigger it, and the branch had to be added to
`on.push.branches` instead. That is no longer necessary now the workflow is on
`main`.

To check the base path without GitHub at all, build with it and serve the result
from a matching subfolder:

```bash
VITE_BASE=/qr-school/ npm run build
mkdir -p /tmp/pages/qr-school && cp -r dist/* /tmp/pages/qr-school/
python3 -m http.server 8080 --directory /tmp/pages
# then open http://localhost:8080/qr-school/
```

`http://localhost` counts as a secure context, so the folder picker works there
just as it does over HTTPS.

### What the build ships

`npm run build` minifies everything it produces. Vite does the JavaScript and
the CSS on its own — esbuild, no configuration — and a small `transformIndexHtml`
plugin in `vite.config.ts` does the HTML, which Vite otherwise copies out
verbatim, indentation and source comments included. Gzipped, over the wire:

| File          | Before  | After   |
| ------------- | ------- | ------- |
| `index.html`  | 2.39 kB | 2.20 kB |
| `labels.html` | 2.57 kB | 2.23 kB |
| `photos.html` | 3.05 kB | 2.52 kB |
| stylesheet    | 5.10 kB | 5.05 kB |

The stylesheet shrank for a different reason: Tailwind used to detect its own
sources, which means reading every file in the repository, and the English prose
of this README was enough to emit `.fixed`, `.static`, `.visible` and
`.lowercase` — utilities no page uses. `style.css` now pins the scan to the three
HTML pages and `src/**/*.ts` with `source(none)` plus explicit `@source` lines.
Add a class anywhere else and it will not be generated.

Collapsing HTML whitespace is a rendering change, not only a size one. It is
safe here because nothing walks the DOM by sibling or child index, and it was
checked rather than assumed: the three pages were screenshotted full-page in
headless Chromium before and after, and the images came back byte-identical.

Two things deliberately **not** done:

- **terser instead of esbuild.** Measured: 0.7 kB gzipped across all the
  JavaScript, for a sixfold build time and one more dependency.
- **pre-compressing the assets.** GitHub Pages gzips text responses itself.

Which leaves the honest summary: a page of this site now costs about 8 kB
gzipped, and the 453 kB of `zxing_reader.wasm` behind the filing page dwarfs
everything above. It is fetched only by that page, only once, and then cached —
see the decoder section for why it is worth its weight.

---

## How the teacher uses it

### 1. Print the labels (once a year)

**Créer les étiquettes** page: type the first names one per line, choose how
many labels per child, click _Générer_ then _Imprimer_.

Each label carries the QR code and the first name in plain text — handy for
handing them out, and for checking by eye that the right label sits next to the
right piece of work. The list is remembered in the browser.

Each first name also gets a colour and a small drawing, both derived from the
name itself: a child who cannot read yet still finds "the orange label with the
fox", and the same child gets the same label again next term.

**L'allure des étiquettes** sets the style of the whole sheet, and is remembered
from one session to the next:

| Setting          | Choices                                                                      |
| ---------------- | ---------------------------------------------------------------------------- |
| _Taille_         | 4, 3 or 2 labels per row                                                     |
| _Couleurs_       | Arc-en-ciel, Océan, Bonbons, a single colour of your own, or plain black ink |
| _Petits dessins_ | Animaux, Nature, Espace, or none                                             |

The sheet is redrawn as soon as a setting changes — no need to generate again.

**A label is never cut in half by a page break.** The sheet is not a stream of
labels the printer breaks wherever the page ends: `label-layout.ts` fixes the
whole geometry in millimetres, works out how many rows fit in the printable area
of an A4 page, and `labels.ts` puts each pageful in its own element with the page
break in between. The browser only breaks where the app already broke. On screen
the sheet is drawn as the pages themselves, margins included and numbered
_Page 1 sur 3_, so what she sees is what comes out of the printer.

| Size     | Label   | Per page   |
| -------- | ------- | ---------- |
| Petites  | 45.5 mm | 4 × 5 = 20 |
| Moyennes | 62 mm   | 3 × 4 = 12 |
| Grandes  | 95 mm   | 2 × 3 = 6  |

The height of a label is fixed too, with room for a first name on two lines, so
`Marie-Charlotte D` does not push its row off the page. Two things stay outside
the app's control and belong in the print dialog: the paper must be **A4** at
**100 %**, and the browser's own **headers and footers** must be off, or the URL
and the date land on the top row of labels. The page says so under the button.

Whatever is chosen, the ink stays dark: zxing thresholds on brightness, so a
pastel code would stop being read. The three palettes are vetted colours below
40 % of the brightness of white, and a colour picked by hand is darkened until
it gets there — canary yellow prints as mustard, and the field shows the colour
that will really be used. `photo-reading.test.ts` photographs every ink of every
palette at a 30° tilt and checks the first name comes back.

If there are two `Léa` in the class, write `Léa B` and `Léa M`.

### 2. Take the photos

Put the label next to the work and shoot. The label must be fully visible and
take up a reasonable share of the frame — as a rule of thumb the QR should not
be narrower than a twentieth of the photo. A tilt of 15–40° is fine; see the
decoder section for the measured limits.

### 3. File the photos

**Ranger les photos** page:

1. _Choisir le dossier des photos_ → the SD card or phone folder.
2. _Choisir le dossier de destination_ → e.g. `Documents\Travaux 2026`.
3. _Analyser les photos_ → every QR code is read, then a gallery appears: one
   card per photo with the image, the first name found, the name the file will
   take and its status. The reading is spread over the machine's cores, so the
   page keeps answering while a folder goes through — see _Reading a folder_
   below.
4. Fix the missing first names. Those photos **move to the front of the gallery**
   and carry a thick border: they are the only ones asking for anything. A
   banner gives the count. As soon as a name is typed, the card rejoins the rest.
5. _Copier les photos_.

The first name field offers the class list as autocompletion, taken from the
labels page. Thumbnail size is adjustable — Petites, Moyennes, Grandes — and the
choice is remembered.

Original photos are **never modified or deleted**, only copied. Filing the same
folder twice overwrites nothing: numbering continues. Note that it follows the
order of the photos, not the order they are displayed in — a card moved to the
front keeps the number matching its place in the folder.

---

## Browsers

| Browser                                                   | Result                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Any Chromium browser: Vivaldi, Brave, Chrome, Edge, Opera | everything works, files written straight into the chosen folder                       |
| Firefox, Safari                                           | scanning works, but renamed photos arrive one by one in Downloads, without subfolders |

Where the two warnings have to name browsers, they name them in that order —
Vivaldi, Brave, Chrome, Edge. Any of them works; the order is a preference, and
Edge comes last because its only merit here is being already installed on the
school's Windows.

Those names are advice, never a test. What the pages act on is
`showDirectoryPicker`, asked for in `folder-access.ts`: that is what actually
separates the two rows above, whereas a list of names would sooner or later
accuse a Chromium fork that works perfectly well. The home page keeps quiet
where the picker exists and shows the Downloads warning where it does not; the
filing page additionally disables the destination folder and the per-first-name
subfolders, which it cannot honour through downloads.

---

## Development

```bash
npm install
npm run dev           # local server with hot reload
npm run verify        # the whole chain, same as CI
npm run format        # apply Prettier
npm run format:check  # check without writing
npm run lint          # ESLint
npm run lint:fix      # ESLint with autofixes
npm run typecheck     # tsc --noEmit, strict
npm test              # unit tests (Vitest)
npm run build         # static site into dist/
npm run preview       # serve dist/ to check the build
```

TypeScript in strict mode (including `noUncheckedIndexedAccess`), Tailwind CSS 4
through its Vite plugin, no UI framework: the DOM is driven directly and the app
fits in a few hundred lines.

| File                             | Role                                                     |
| -------------------------------- | -------------------------------------------------------- |
| `src/names.ts`                   | first names, extensions, output file names — DOM-free    |
| `src/filing.ts`                  | numbering and free-name lookup — no DOM, no disk         |
| `src/qr-decoding.ts`             | decoding a QR code — DOM-free, tested without a browser  |
| `src/qr-generation.ts`           | generating the label QR codes                            |
| `src/label-theme.ts`             | palettes, drawings and label options — DOM-free          |
| `src/label-layout.ts`            | sheet geometry and pagination in mm — DOM-free           |
| `src/photo-reading.ts`           | reading one photo: its QR code and its thumbnail         |
| `src/photo-scanning.ts`          | reading a folder: the pool of workers                    |
| `src/scan-worker.ts`             | one photo at a time, off the page's thread               |
| `src/dom.ts`                     | element lookup with a runtime type check                 |
| `src/folder-access.ts`           | File System Access types, and whether the browser has it |
| `src/photos.ts`, `src/labels.ts` | interface wiring                                         |

Business logic is deliberately kept away from the DOM: `names.ts` and `filing.ts`
are tested without a browser, and `filing.ts` only touches the disk through an
`exists` predicate that tests replace.

### Reading a folder

Reading a photo is the only slow thing the app does: zxing needs the full
resolution to recover a tilted label, and that costs a few hundred milliseconds
per 12 Mpx photo. A term's folder is a few hundred of them, so doing it one at a
time on the page's own thread meant minutes of a frozen interface.

`photo-scanning.ts` therefore keeps one worker per core, minus one for the page.
Measured in Chromium on four cores, 24 photos of 4000 × 3000, five runs each:

|                      | one at a time (before) | pool of workers |
| -------------------- | ---------------------- | --------------- |
| whole folder         | 5.0 – 6.5 s            | **2.7 – 3.4 s** |
| longest frozen frame | 283 – 350 ms           | **17 – 33 ms**  |

The interface never drops a frame now, which matters more than the stopwatch:
the progress bar used to stutter and the gallery froze between photos.

Two things the pool has to get right:

- **Order.** Workers finish in whatever order they please, but a photo is only
  handed to the page once every photo before it has been. Numbering follows the
  order of the folder, not the order the decoder happened to finish in, so
  `Léa_01` is always the first of Léa's photos on the card.
- **Falling back.** A browser without `Worker` — or one that refuses module
  workers — reads the photos on the page's thread instead. That is exactly the
  old behaviour, and it was measured to confirm it: 5.0 – 5.4 s, the old speed.

Thumbnails cross back as JPEG blobs rather than data URLs: no base64 copy on the
way out of the worker, a third of the memory, and the page owns the object URL
and releases it when the gallery is rebuilt.

## Language convention

Code is English, the interface is French. Concretely:

- identifiers, comments, commit messages, test names, HTML `id`s and CSS class
  names are English;
- every string the teacher can read stays French — page copy, button labels,
  `aria-label`s, placeholders, status messages, and the `Sans-nom` fallback that
  ends up in a file name;
- French is kept where it is behaviour rather than prose: `<html lang="fr">`,
  `localeCompare(…, 'fr')`, and the French keys `extractFirstName` accepts
  (`prenom=`, `nom=`) because that is what a French label generator would emit.

## Recognition libraries

**There is no first-name recognition.** The name is not _read_ from the label,
it is _carried_ by the QR code. No OCR, no Tesseract, no vision model — that is
what makes the project reliable. The fallback when reading fails is not a second
algorithm: the teacher types the name on the card, helped by autocompletion from
the class list.

### The decoder: zxing-wasm, and why not the popular ones

One decoder, [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) — the
WebAssembly build of [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp). It
reads the photo file in a single full-resolution pass: no downscaling, no tiling,
no native detector to try first.

This goes against popularity, and it was measured. Four decoders were run over
the same 22 photos, built by 3D projection of the label followed by an inverse
homography — real perspective images, not mere rotations:

| Decoder                                               | Decoded     | Total time | Tilt            |
| ----------------------------------------------------- | ----------- | ---------- | --------------- |
| [jsQR](https://github.com/cozmo/jsQR)                 | 7 / 22      | 33.9 s     | fails from 15°  |
| [@zxing/library](https://github.com/zxing-js/library) | 7 / 22      | 19.9 s     | fails from 15°  |
| [qr-scanner](https://github.com/nimiq/qr-scanner)     | 6 / 22      | 23.0 s     | fails from 15°  |
| **zxing-wasm**                                        | **17 / 22** | **2.4 s**  | holds up to 45° |

The three pure-JavaScript options fail in the same place because they are the
same engine: `qr-scanner` forks the jsQR port, itself a port of the old Java
ZXing, of which `@zxing/library` is the other port. They all inherit the same
grid extraction, which cannot rectify perspective. A hand-held photo is almost
always tilted by 15–40°, so that is the normal case, not the edge case.

`BarcodeDetector`, the browser's built-in API, was **deliberately dropped**. It
is still experimental and its availability depends on the operating system, so
it introduced a code path whose behaviour varied per machine — impossible to
reproduce when troubleshooting remotely — for no gain against zxing-wasm's
100 ms.

The price is weight: ~450 kB gzipped of WebAssembly against 52 kB for jsQR.
Loaded once, cached by the browser, on a tool used once a week from a desktop.

On maintenance risk: `zxing-wasm` is a thin wrapper, the decoder is `zxing-cpp`,
pinned as a submodule at a specific commit (the package exports it as
`ZXING_CPP_COMMIT`). If the wrapper were abandoned, the `.wasm` stays frozen in
the lockfile and bundled as a local asset: nothing to recover, no remote
service. That is a very different risk profile from an abandoned decoder, which
would never catch up.

### Generation

[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (2.0, MIT,
~20 kB), with `stringToBytes` forced to UTF-8 — otherwise version 2 encodes as
latin-1 and « Léa » comes back as mojibake. Error correction level _M_: a label
that is slightly damaged or poorly lit still scans.

Other points:

- EXIF orientation is honoured (`imageOrientation: 'from-image'`), so portrait
  photos are read correctly.
- Characters Windows forbids (`< > : " / \ | ? *`) are stripped from file names;
  accents and hyphens are kept.
- Each page loads only what it needs: the label sheet does not download the
  decoder, and vice versa.
- No CDN: everything is bundled by Vite.

## Code quality

**ESLint 10** in flat config, with responsibilities split as follows:

| Scope              | Configuration                                                       |
| ------------------ | ------------------------------------------------------------------- |
| `src/**/*.ts`      | `typescript-eslint` in `strictTypeChecked` + `stylisticTypeChecked` |
| `src/**/*.test.ts` | plus `@vitest/eslint-plugin`                                        |
| `*.html`           | `@html-eslint`, mostly for accessibility                            |

The type-aware rules are the real value: they need the TypeScript program
(`projectService: true`) and catch what a syntax-only linter misses —
`no-floating-promises` on a promise dropped in an event handler,
`no-unnecessary-condition` on a guard that has become dead.

On the HTML side the rules kept are the ones that protect the user:
`require-input-label`, `require-img-alt`, `require-button-type`,
`no-positive-tabindex`, `no-duplicate-id`, `use-baseline`.

**Prettier 3** with `prettier-plugin-tailwindcss`, which sorts the utility
classes in framework order — without it they drift into an unreadable mess.
Prettier is the **sole** owner of formatting: `eslint-config-prettier` disables
the competing TypeScript rules, and an explicit list does the same for
`@html-eslint`, which `eslint-config-prettier` does not cover.

TypeScript is deliberately pinned to **6.0.x**: `typescript-eslint` 8 declares
`typescript@<6.1.0` as a peer and therefore refuses TypeScript 7. Bump it when
upstream catches up.

## Tests

`npm test` covers, without a browser:

- first names and output file names (accents, forbidden characters, patterns);
- numbering, including a second pass over the same photos, which must continue
  at `_03` instead of overwriting `_01`;
- **sheet geometry**: a full page of labels fits inside the printable area of an
  A4 page at every size, one more row would not, and the pages a run of labels
  is cut into are full but for the last. The stylesheet reads those same
  millimetres back as custom properties, so the count and the drawing cannot
  drift apart;
- **decoder robustness** on synthetic but realistic photos: the QR code is
  generated by the very function the labels page uses, then projected in 3D and
  rendered through an inverse homography with bilinear sampling. Covered: tilt up
  to 45° on one axis and 35° on two, in-plane rotation, tilt combined with
  rotation, and a label shrunk to 150 px inside a 3000 × 2000 photo.

Projecting the label rather than rotating it is not a detail: the first version
of these tests used perfectly square QR codes, and therefore let through the one
degradation the decoder of the time could not handle.

One test also pins an **accepted limit** — beyond a 60° tilt nothing is decoded.
If it ever starts passing, that is good news to notice, not a regression.

What the tests do not cover, and has to be checked by hand: the native Windows
folder picker, real camera photos, and the worker pool — `scan-worker.ts` and
`photo-scanning.ts` need a browser, so they are verified by running a folder
through both builds and comparing, not by `npm test`.

The printed sheet itself was checked outside the test suite, by driving Chromium
headlessly (`page.pdf`) over the three sizes and reading the result back: the
pages came out at the count the layout announces, every page carried exactly the
labels planned for it, and all of them decoded — 20, 12 then 6 per page, none cut
by a page break, including with names long enough to wrap. Worth redoing by hand
after any change to the size of a label.

## Known limitations

- **HEIC/HEIF** files (the iPhone default) cannot be decoded by the browser;
  they are listed and flagged as such. Set the iPhone to "Most Compatible"
  (JPEG), or convert beforehand.
- Only one QR code per photo is used (the first one found).
- Correcting a first name after the copy re-copies the photo under the new name,
  but the earlier copy stays on disk — there is no undo in the interface.
- Moving instead of copying is deliberately not offered.
- The chosen folders are not remembered between sessions.
- The native folder picker cannot be driven by an automated test: that part is
  only verified by hand.
