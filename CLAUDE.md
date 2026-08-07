# Working in this repository

`README.md` is the reference: how the teacher uses the app, how it is deployed,
and what each file does. Read it before a first change. What follows is only
what an agent gets wrong without being told.

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
teacher. Identifiers, comments, tests, HTML `id`s and CSS class names in
English; everything she can read in French. See _Language convention_ in the
README for the exact boundary.

## Before saying it works

```bash
npm run verify   # format:check, lint, typecheck, tests, build
```

`npm run verify` is the gate; the CI runs the same thing. Nothing is "done"
until it passes.

Tests carry the intent, not just the assertion: `photo-reading.test.ts` builds
fake photos by 3D projection because that, not a rotated image, is what a
hand-held photo looks like. Extend that suite rather than weakening it — and if
a test documents a limit that starts passing, that is news to notice, not a
failure to silence.

## The one constraint that breaks the app silently

**A label the decoder cannot read looks perfectly fine on screen.** Every ink
stays dark: zxing thresholds on brightness alone, so a pastel QR code stops
being decoded while still looking like a QR code. The palettes in
`label-theme.ts` sit under 40 % of the brightness of white, and a colour picked
by hand goes through `readableInk` first.

Anything touching the appearance of a label — colour, module shape, quiet zone,
size, the white patch under the code — is a decoding change. Photograph it in
`photo-reading.test.ts` and check the first name comes back.
