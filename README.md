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

Whatever the palette, the ink stays dark — see [Contrast](#contrast) below.

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

1. _Choisir le dossier des photos_ — the SD card or phone folder.
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

| Browser                                                   | Result                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Any Chromium browser: Vivaldi, Brave, Chrome, Edge, Opera | everything works, files written straight into the chosen folder                       |
| Firefox, Safari                                           | scanning works, but renamed photos arrive one by one in Downloads, without subfolders |

The pages never test for a browser name: they check for `showDirectoryPicker`
(`folder-access.ts`), which is what actually separates the two rows. Where it is
missing, the home page shows the Downloads warning and the filing page disables
the destination folder and the per-name subfolders.

## Deployment

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
npm run verify        # format:check, lint, typecheck, tests, build — same as CI
npm test              # unit tests (Vitest)
npm run build         # static site into dist/
npm run preview       # serve dist/ to check the build
```

`npm run verify` is the gate. TypeScript in strict mode (including
`noUncheckedIndexedAccess`), Tailwind CSS 4 through its Vite plugin, no UI
framework.

| File                             | Role                                                     |
| -------------------------------- | -------------------------------------------------------- |
| `src/names.ts`                   | first names, extensions, output file names — DOM-free    |
| `src/filing.ts`                  | numbering and free-name lookup — no DOM, no disk         |
| `src/qr-decoding.ts`             | decoding a QR code — DOM-free, tested without a browser  |
| `src/qr-generation.ts`           | generating the label QR codes                            |
| `src/label-theme.ts`             | palettes, drawings and label options — DOM-free          |
| `src/label-layout.ts`            | sheet geometry and pagination in mm — DOM-free           |
| `src/photo-reading.ts`           | reading one photo: its QR code and its thumbnail         |
| `src/photo-scanning.ts`          | reading a folder: the pool of workers, one per core      |
| `src/scan-worker.ts`             | one photo at a time, off the page's thread               |
| `src/dom.ts`                     | element lookup with a runtime type check                 |
| `src/folder-access.ts`           | File System Access types, and whether the browser has it |
| `src/photos.ts`, `src/labels.ts` | interface wiring                                         |

Business logic is kept away from the DOM: `names.ts` and `filing.ts` are tested
without a browser, and `filing.ts` only touches the disk through an `exists`
predicate that tests replace.

`npm test` does not cover the native folder picker, real camera photos, or the
worker pool — those need a browser and are checked by hand.

### Contrast

**A label the decoder cannot read still looks fine on screen.** zxing thresholds
on brightness alone, so a pastel QR code stops decoding while still looking like
a QR code. Every palette in `label-theme.ts` sits below 40 % of the brightness of
white, and a colour picked by hand is darkened by `readableInk` until it gets
there — canary yellow prints as mustard.

Anything touching the appearance of a label — colour, module shape, quiet zone,
size, the white patch under the code — is a decoding change. Photograph it in
`photo-reading.test.ts` and check the first name comes back. That suite builds
its photos by 3D projection rather than rotation, because that is what a
hand-held photo actually looks like.

### Language convention

Code is English, the interface is French. Concretely:

- identifiers, comments, commit messages, test names, HTML `id`s and CSS class
  names are English;
- every string the teacher can read stays French — page copy, button labels,
  `aria-label`s, placeholders, status messages, and the `Sans-nom` fallback that
  ends up in a file name;
- French is kept where it is behaviour rather than prose: `<html lang="fr">`,
  `localeCompare(…, 'fr')`, and the French keys `extractFirstName` accepts
  (`prenom=`, `nom=`), because that is what a French label generator emits.

The `localStorage` keys still use the project's old name (`qr-school.names`,
`qr-school.label-options`, `qr-school.size`). They point at data already in the
teacher's browser; renaming them would silently empty her class list.

## Known limitations

- **HEIC/HEIF** files (the iPhone default) cannot be decoded by the browser;
  they are listed and flagged as such. Set the iPhone to "Most Compatible"
  (JPEG), or convert beforehand.
- Only the first QR code found in a photo is used.
- Correcting a first name after the copy re-copies the photo under the new name,
  but the earlier copy stays on disk — there is no undo.
- Moving instead of copying is not offered.
- The chosen folders are not remembered between sessions.

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
