# Photos d'élèves — reconnaissance par QR code

Petite application web qui range automatiquement les photos des travaux d'élèves.
La maîtresse pose une étiquette QR (avec le prénom) à côté du travail, photographie
le tout, puis l'application relit le QR code et copie chaque photo sous le nom
`Prénom_date_numéro.jpg`, dans un sous-dossier par enfant.

**Rien à installer. Aucune ligne de commande. Rien n'est envoyé sur Internet :
tout le traitement se fait dans le navigateur, sur l'ordinateur de la maîtresse.**

---

## Pourquoi une page web et pas Python ni Go

La contrainte principale est « une maîtresse, un PC Windows, pas de ligne de
commande ». C'est elle qui décide de la technologie :

|                       | Python                                                      | Go                           | **Page web statique (TypeScript)**              |
| --------------------- | ----------------------------------------------------------- | ---------------------------- | ----------------------------------------------- |
| Installation          | Python + dépendances, ou un `.exe` PyInstaller de 60–150 Mo | un `.exe` de ~10 Mo à copier | **rien, une adresse à mettre en favori**        |
| Lancement             | double-clic sur un `.exe` → alerte SmartScreen / antivirus  | idem                         | **on clique sur le favori**                     |
| Mise à jour           | renvoyer un nouvel `.exe` à chaque correction               | idem                         | **`git push`, elle recharge la page**           |
| Hébergement           | —                                                           | —                            | **GitHub Pages, gratuit**                       |
| Lecture du QR         | pyzbar/OpenCV                                               | gozxing                      | zxing-wasm (WebAssembly de zxing-cpp)           |
| Écriture des fichiers | libre                                                       | libre                        | dossier choisi par l'utilisatrice (Edge/Chrome) |

Le seul vrai avantage de Python ou Go serait l'accès libre au disque. Or depuis
2021 les navigateurs Chromium savent le faire : l'API **File System Access**
permet de choisir un dossier et d'y écrire, après un clic explicite de
l'utilisatrice. C'est exactement le besoin ici, sans serveur local ni exécutable
à faire passer l'antivirus de l'école.

Deux points qui ont fait pencher la balance :

- **Pas d'OCR.** Le prénom n'est pas lu sur l'étiquette : il est _dans_ le QR code.
  C'est la partie la plus fragile du projet qui disparaît complètement. On n'a
  donc besoin ni de Tesseract, ni d'un modèle de reconnaissance de texte.
- **Zéro maintenance côté poste.** Pas d'exécutable à redéployer, pas de version
  périmée sur le PC de la classe.

**Quand faudra-t-il changer d'avis ?** Si un jour il faut traiter des photos HEIC
(iPhone), lire des milliers de photos d'un coup, ou tourner sur un PC bridé sous
Firefox uniquement, alors un binaire Go unique (interface web servie en local sur
`http://localhost:8080`, ouverte automatiquement au double-clic) devient le bon
plan B. Le code de cette version resterait largement réutilisable.

---

## Mise en ligne (une seule fois)

1. Pousser ce dépôt sur GitHub.
2. `Settings` → `Pages` → _Source_ : **GitHub Actions**.
3. Le workflow `.github/workflows/deploy.yml` fait le reste : à chaque push sur
   `main`, il vérifie les types, lance les tests, construit le site et le
   publie. Les pull requests passent les mêmes vérifications sans déployer.
4. Au bout d'une minute, le site est à l'adresse
   `https://<utilisateur>.github.io/qr-school/`.
5. Envoyer cette adresse à la maîtresse et lui faire mettre un favori sur le
   bureau.

Le chemin de base est calculé automatiquement à partir du nom du dépôt
(`VITE_BASE`) ; en local, `npm run dev` sert à la racine. HTTPS est
indispensable — l'API d'accès aux dossiers ne fonctionne pas en `file://` — et
GitHub Pages le fournit d'office.

---

## Mode d'emploi

### 1. Créer les étiquettes (une fois par an)

Page **Créer les étiquettes** : taper la liste des prénoms, un par ligne, choisir
le nombre d'étiquettes par enfant, cliquer sur _Générer_ puis _Imprimer_.

Chaque étiquette porte le QR code et le prénom écrit en dessous — pratique pour
que la maîtresse les distribue, et pour vérifier à l'œil que la bonne étiquette
est sur le bon travail. Les prénoms sont mémorisés dans le navigateur, pas besoin
de les retaper.

S'il y a deux `Léa` dans la classe, écrire `Léa B` et `Léa M`.

Conseil : plastifier ou coller les étiquettes sur des petits cartons réutilisables.

### 2. Photographier

Poser l'étiquette à côté du travail et prendre la photo. L'étiquette doit être
bien à plat, entière, et occuper une part visible de l'image (en gros, le QR ne
doit pas faire moins d'un vingtième de la largeur de la photo).

### 3. Ranger les photos

Page **Ranger les photos** :

1. _Choisir le dossier des photos_ → le dossier de la carte SD ou du téléphone.
2. _Choisir le dossier de destination_ → par exemple `Documents\Travaux 2026`.
3. _Analyser les photos_ → chaque QR code est lu, un tableau s'affiche avec la
   vignette, le prénom trouvé et le futur nom de fichier.
4. Corriger éventuellement les prénoms manquants (surlignés en jaune) : soit en
   tapant dans la case, soit avec le bouton _Compléter les vides avec le prénom
   du dessus_ — pratique quand plusieurs photos du même enfant se suivent.
5. _Copier les photos_.

Les photos d'origine ne sont **ni modifiées ni supprimées**, uniquement copiées.
Relancer le rangement deux fois n'écrase rien : la numérotation reprend à la
suite.

---

## Navigateurs

| Navigateur                              | Résultat                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Microsoft Edge, Google Chrome (Windows) | tout fonctionne, écriture directe dans le dossier choisi                                                          |
| Firefox, Safari                         | l'analyse fonctionne, mais les photos renommées arrivent une par une dans « Téléchargements », sans sous-dossiers |

Edge étant installé par défaut sur Windows, c'est le choix à recommander.

---

## Développement

```bash
npm install
npm run dev           # serveur local avec rechargement à chaud
npm run verifier      # toute la chaîne, comme la CI
npm run format        # applique Prettier
npm run format:check  # vérifie sans modifier
npm run lint          # ESLint
npm run lint:fix      # ESLint avec corrections automatiques
npm run typecheck     # tsc --noEmit, mode strict
npm test              # tests unitaires (Vitest)
npm run build         # site statique dans dist/
npm run preview       # sert dist/ pour vérifier le build
```

TypeScript en mode strict (`noUncheckedIndexedAccess` compris), Tailwind CSS 4
via le plugin Vite, aucun framework d'interface : le DOM est manipulé
directement, l'application tient en quelques centaines de lignes.

| Fichier                              | Rôle                                                          |
| ------------------------------------ | ------------------------------------------------------------- |
| `src/noms.ts`                        | prénoms, extensions, noms de fichiers — sans DOM              |
| `src/rangement.ts`                   | numérotation et recherche d'un nom libre — sans DOM ni disque |
| `src/decodage-qr.ts`                 | décodage d'un QR code — sans DOM, testé sans navigateur       |
| `src/lecture-qr.ts`                  | lecture d'une photo : son QR code et sa vignette              |
| `src/generation-qr.ts`               | génération des QR codes des étiquettes                        |
| `src/dom.ts`                         | accès aux éléments de la page, avec contrôle de type          |
| `src/photos.ts`, `src/etiquettes.ts` | câblage de l'interface                                        |

La logique métier est volontairement séparée du DOM : `noms.ts` et
`rangement.ts` sont testés sans navigateur, et `rangement.ts` ne touche au
disque qu'à travers un prédicat `existe` qu'on remplace en test.

## Bibliothèques de reconnaissance

**Il n'y a pas de reconnaissance de prénom.** Le prénom n'est pas _lu_ sur
l'étiquette, il est _contenu_ dans le QR code. Il n'y a donc ni OCR, ni
Tesseract, ni modèle de vision — c'est ce qui rend le projet fiable et léger.
Le repli quand la lecture échoue n'est pas un second algorithme : c'est la
maîtresse qui corrige la case dans le tableau, avec le bouton « compléter les
vides avec le prénom du dessus » pour les séries.

### Le décodeur : zxing-wasm, et pourquoi pas les plus populaires

Un seul décodeur,
[zxing-wasm](https://github.com/Sec-ant/zxing-wasm) — la compilation
WebAssembly de [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp). Il lit le
fichier photo en une passe pleine résolution : ni redimensionnement, ni
découpage en zones, ni détection native à essayer d'abord.

Ce choix va contre la popularité, et il a été mesuré. Quatre décodeurs ont été
passés sur les mêmes 22 photos, fabriquées par projection 3D de l'étiquette puis
homographie inverse — c'est-à-dire de vraies images en perspective, pas de
simples rotations :

| Décodeur                                              | Cas décodés | Temps cumulé | Inclinaison    |
| ----------------------------------------------------- | ----------- | ------------ | -------------- |
| [jsQR](https://github.com/cozmo/jsQR)                 | 7 / 22      | 33,9 s       | échec dès 15°  |
| [@zxing/library](https://github.com/zxing-js/library) | 7 / 22      | 19,9 s       | échec dès 15°  |
| [qr-scanner](https://github.com/nimiq/qr-scanner)     | 6 / 22      | 23,0 s       | échec dès 15°  |
| **zxing-wasm**                                        | **17 / 22** | **2,4 s**    | OK jusqu'à 45° |

Les trois options en JavaScript pur échouent au même endroit parce qu'elles sont
le même moteur : `qr-scanner` est un fork du portage jsQR, lui-même un portage de
l'ancien ZXing Java, dont `@zxing/library` est l'autre portage. Elles héritent
toutes de la même extraction de grille, incapable de redresser une perspective.
Or une photo prise à main levée est presque toujours inclinée de 15 à 40° : c'est
le cas normal, pas le cas limite.

`BarcodeDetector`, l'API intégrée au navigateur, a été **retirée
volontairement**. Elle reste expérimentale et son support dépend du système
d'exploitation, donc elle introduisait un chemin de code au comportement
variable selon le poste — impossible à reproduire lors d'un dépannage à
distance — pour un gain nul face aux 100 ms de zxing-wasm.

Le prix est le poids : ~450 ko gzippés de WebAssembly, contre 52 ko pour jsQR.
Chargé une fois, mis en cache par le navigateur, sur un outil utilisé une fois
par semaine depuis un ordinateur de bureau.

Sur le risque de maintenance : `zxing-wasm` est une enveloppe mince, le décodeur
est `zxing-cpp`, épinglé comme sous-module à un commit précis (exporté par le
paquet sous `ZXING_CPP_COMMIT`). Si l'enveloppe était abandonnée, le `.wasm`
reste figé dans le lockfile et empaqueté comme asset local : rien à récupérer,
aucun service distant. C'est un profil de risque très différent de celui d'un
décodeur abandonné, qui ne rattrapera jamais son retard.

### La génération

Pour la génération :
[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (2.0, MIT,
~20 kB), avec `stringToBytes` forcé en UTF-8 — sans quoi la version 2 encode en
latin-1 et « Léa » revient en mojibake. Correction d'erreur niveau _M_ : une
étiquette un peu abîmée ou mal éclairée reste lisible.

Autres points :

- L'orientation EXIF est prise en compte (`imageOrientation: 'from-image'`), donc
  les photos prises en portrait sont lues correctement.
- Les caractères interdits sous Windows (`< > : " / \ | ? *`) sont retirés des
  noms de fichiers ; les accents et les traits d'union sont conservés.
- Chaque page ne charge que ce dont elle a besoin : la planche d'étiquettes ne
  télécharge pas le décodeur, et inversement.
- Aucun CDN : tout est empaqueté par Vite.

## Qualité du code

**ESLint 10** en configuration plate, avec le partage des rôles suivant :

| Périmètre          | Configuration                                                       |
| ------------------ | ------------------------------------------------------------------- |
| `src/**/*.ts`      | `typescript-eslint` en `strictTypeChecked` + `stylisticTypeChecked` |
| `src/**/*.test.ts` | `@vitest/eslint-plugin` en plus                                     |
| `*.html`           | `@html-eslint`, surtout pour l'accessibilité                        |

Les règles typées sont le vrai apport : elles ont besoin du programme
TypeScript (`projectService: true`) et attrapent ce qu'un linter syntaxique
laisse passer — `no-floating-promises` sur une promesse oubliée dans un
gestionnaire d'événement, `no-unnecessary-condition` sur une garde devenue
morte.

Côté HTML, les règles retenues sont celles qui protègent l'utilisatrice :
`require-input-label`, `require-img-alt`, `require-button-type`,
`no-positive-tabindex`, `no-duplicate-id`, `use-baseline`.

**Prettier 3** avec `prettier-plugin-tailwindcss`, qui range les classes
utilitaires dans l'ordre du framework — sans quoi elles dérivent vers un
désordre impossible à relire. Prettier est **seul** responsable de la mise en
forme : `eslint-config-prettier` neutralise les règles concurrentes côté
TypeScript, et une liste explicite fait le même travail pour `@html-eslint`,
que `eslint-config-prettier` ne couvre pas.

TypeScript est volontairement épinglé en **6.0.x** : `typescript-eslint` 8
déclare `typescript@<6.1.0` en pair, et refuse donc TypeScript 7. À bumper
quand l'amont suivra.

## Tests

`npm test` couvre, sans navigateur :

- les prénoms et noms de fichiers (accents, caractères interdits, modèles) ;
- la numérotation, y compris le deuxième passage sur les mêmes photos, qui doit
  reprendre à `_03` au lieu d'écraser `_01` ;
- la **robustesse du décodage**, sur des photos synthétiques mais réalistes : le
  QR code est généré par la fonction que la page d'étiquettes utilise
  réellement, puis projeté en 3D et rendu par homographie inverse avec
  échantillonnage bilinéaire. Sont couverts l'inclinaison jusqu'à 45° sur un axe
  et 35° sur deux, la rotation dans le plan, l'inclinaison combinée à la
  rotation, et l'étiquette réduite à 150 px dans une photo de 3000 × 2000.

Le fait de projeter l'étiquette au lieu de la tourner n'est pas un détail : la
première version de ces tests utilisait des QR parfaitement droits, et laissait
donc passer la seule dégradation que le décodeur d'alors ne savait pas traiter.

Un test verrouille aussi une **limite assumée** — au-delà de 60° d'inclinaison,
rien n'est décodé. S'il se met à passer un jour, c'est une bonne nouvelle à
constater, pas une régression à corriger.

Ce que les tests ne couvrent pas et qu'il faut vérifier à la main : le sélecteur
de dossier natif de Windows, et de vraies photos d'appareil.

## Limites connues

- Les fichiers **HEIC/HEIF** (iPhone par défaut) ne sont pas lisibles par le
  navigateur ; ils sont listés et signalés comme tels. Régler l'iPhone sur
  « Le plus compatible » (JPEG), ou prévoir une conversion.
- Un seul QR code par photo est utilisé (le premier trouvé).
- Le déplacement (au lieu de la copie) n'est pas proposé, volontairement.
- Les dossiers choisis ne sont pas mémorisés d'une session à l'autre.
- Le sélecteur de dossier natif ne peut pas être piloté par un test automatisé :
  cette partie n'est vérifiée qu'à la main.
