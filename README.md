# Zou

Files photos of pupils' work automatically. The teacher puts a QR label carrying
the child's first name next to the work, photographs the two together, and the
app reads the QR code back to copy each photo into a per-child subfolder.

Nothing to install, no command line, and no upload: everything runs in the
browser. Once deployed, the app is a bookmark.

The interface is in French — the user is a French primary school teacher.
Everything else, this file included, is in English.

## Using it

### 1. Print the labels — once a year

On the **Créer les étiquettes** page: type the first names one per line, choose
how many labels per child, then _Générer_ and _Imprimer_. The list is remembered
in the browser.

Each label carries the QR code and the first name in plain text. Each first name
also gets a colour and a small drawing derived from the name itself, so a child
who cannot read yet still finds "the orange label with the fox" — and finds the
same one again next term.

**L'allure des étiquettes** sets the style of the whole sheet and is remembered
between sessions:

| Setting          | Choices                                                                      |
| ---------------- | ---------------------------------------------------------------------------- |
| _Taille_         | 4, 3 or 2 labels per row (20, 12 or 6 per A4 page)                           |
| _Couleurs_       | Arc-en-ciel, Océan, Bonbons, a single colour of your own, or plain black ink |
| _Petits dessins_ | Animaux, Nature, Espace, or none                                             |

Whatever the palette, the ink comes out dark: a pale colour would still look
like a QR code on screen and stop being readable, so the app darkens it. Canary
yellow prints as mustard, and that is on purpose.

The sheet is laid out in millimetres and cut into pages by the app, so no label
is ever split by a page break, and the screen shows the actual pages. Two things
belong in the print dialog rather than the app: the paper must be **A4 at 100 %**,
and the browser's own **headers and footers** must be off, or the URL and the
date land on the top row of labels.

If there are two `Léa` in the class, write `Léa B` and `Léa M`.

### 2. Take the photos

Put the label next to the work and shoot. The label must be fully visible and
take up a reasonable share of the frame — as a rule of thumb the QR code should
not be narrower than a twentieth of the photo. A tilt of 15–40° is fine.

### 3. File the photos

On the **Ranger les photos** page:

1. _Choisir le dossier des photos_ — the SD card or phone folder. Both folders
   are offered back the following week under _Reprendre_: the browser will not
   reopen a folder on its own, but one click is shorter than the file dialog.
2. _Choisir le dossier de destination_, plus two options: a subfolder per first
   name (on by default) and the file name pattern (`Léa_2026-06-14_01.jpg`,
   `Léa_01.jpg` or `2026-06-14_Léa_01.jpg`). The date is the photo's file date.
3. _Analyser les photos_ — every QR code is read and a gallery appears, one card
   per photo.
4. Fill in the first names that could not be read. Those cards move to the front
   of the gallery with a thick border; a banner gives the count. The field
   autocompletes from the class list typed on the labels page.
5. _Copier les photos_.

Original photos are never modified or deleted, only copied. Filing the same
folder twice overwrites nothing — the numbering continues. It follows the order
of the photos in the folder, not the order the gallery displays them in.

## Browsers

| Browser                                    | Result                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Chrome and Edge, desktop 86+, Android 132+ | everything works, files written straight into the chosen folder                       |
| Firefox, Safari, Brave                     | scanning works, but renamed photos arrive one by one in Downloads, without subfolders |

Neither the engine nor the platform decides that table, which is why the warning
must not read one off the other:

- **Brave is Chromium and still lands in the second row.** It defines
  `kFileSystemAccessAPI` as `FEATURE_DISABLED_BY_DEFAULT` ([brave-core,
  `chromium_src/third_party/blink/common/features.cc`][brave-feature]) after
  deciding to [remove support for the API][brave-issue] in 2020, so
  `showDirectoryPicker` is simply absent. A desktop Brave can be talked into it
  under `brave://flags/#file-system-access-api`, but that is not something to ask
  of a teacher — and the warning used to send her to Brave, which greeted her
  with the same warning.
- **Android moved.** Chrome had no picker there until version 132 shipped the API
  on Android and in WebView ([MDN compat data][bcd]), so "use a computer" stopped
  being true while nobody was looking.

Firefox and Safari do expose the `FileSystemHandle` interfaces, but only over the
origin-private file system — no picker, so no folder of the teacher's choosing.
Other desktop forks (Vivaldi, Opera) mirror Chrome and very probably work; they
are absent from the table because assuming exactly that is what put Brave in the
wrong row.

[brave-feature]: https://github.com/brave/brave-core/blob/master/chromium_src/third_party/blink/common/features.cc
[brave-issue]: https://github.com/brave/brave-browser/issues/11407
[bcd]: https://developer.mozilla.org/docs/Web/API/Window/showDirectoryPicker

The app says so itself: in a browser of the second row, the filing page warns
about Downloads and greys out the destination folder.

## What it will not do

- **HEIC/HEIF** files (the iPhone default) cannot be decoded by the browser;
  they are listed and flagged as such. Set the iPhone to "Most Compatible"
  (JPEG), or convert beforehand.
- Only the first QR code found in a photo is used.
- Correcting a first name after the copy re-copies the photo under the new name,
  but the earlier copy stays on disk — there is no undo.
- Moving instead of copying is not offered.
- The remembered folders are offered, never reopened silently: browsers only
  renew access to a folder from inside a click, so _Reprendre_ is a button and
  not a page-load effect. A folder that was moved, renamed or unplugged drops
  off the page and has to be picked again.

## Hosting it yourself

1. Push the repository to GitHub.
2. `Settings` → `Pages` → _Source_: **GitHub Actions**.
3. `.github/workflows/deploy.yml` handles the rest: every push to `main` checks
   formatting, lint and types, runs the tests, builds and publishes. Pull
   requests run the same checks without deploying.
4. The site lands on `https://<user>.github.io/<repository>/`. Send that address
   to the teacher and have her bookmark it.

The base path comes from the repository name (`VITE_BASE`); `npm run dev` serves
from the root. HTTPS is mandatory — the folder access API does not work over
`file://` — and GitHub Pages provides it.

**Publishing a branch without merging:** _Actions_ → _Verify and deploy_ → _Run
workflow_ → pick the branch. There is only one Pages site, so this replaces
what is online, including for the teacher. GitHub also gates it separately: the
branch must be allowed under `Settings` → `Environments` → `github-pages` →
_Deployment branches and tags_, or the job fails with "Branch is not allowed to
deploy to github-pages".

## Development

```bash
npm install
npm run dev           # local server with hot reload
npm run verify        # format:check, lint, typecheck, all tests, build — as CI
npm test              # unit tests (Vitest)
npm run test:browser  # browser tests (Playwright), on the built site
npm run build         # static site into dist/
npm run preview       # serve dist/ to check the build
```

`npm run verify` is the gate. TypeScript in strict mode (including
`noUncheckedIndexedAccess`), Tailwind CSS 4 through its Vite plugin, no UI
framework: the DOM is driven directly and the app fits in a few hundred lines.

Business logic stays out of the DOM — most of `src/` is plain functions over
names, file names and geometry, tested in Node, with `photos.ts` and `labels.ts`
doing the wiring. `npm test` covers that half; `npm run test:browser` covers the
half that needs a real browser: the pool of workers, the pages of the sheet, and
writing to a folder. The native folder picker, the download fallback and real
camera photos are checked by hand.

## Licence

[MIT](LICENSE) — fork it, adapt it for another class, host it wherever, keeping
the copyright notice. The notice ships in three places so it is hard to lose by
accident: `LICENSE`, a banner on each entry chunk of the build, and the _Code
source_ link in the page footer.

Two dependencies ship inside the built site under their own terms:

| Bundled                                                                         | Licence    |
| ------------------------------------------------------------------------------- | ---------- |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)           | MIT        |
| [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) wrapper                     | MIT        |
| [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp), inside `zxing_reader.wasm` | Apache-2.0 |

Apache-2.0 asks that its licence text travel with the binary, which is why
`zxing_reader.wasm` is named here rather than left implicit in the lockfile.
