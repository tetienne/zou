# Photos d'élèves — reconnaissance par QR code

Petite application web qui range automatiquement les photos des travaux d'élèves.
La maîtresse pose une étiquette QR (avec le prénom) à côté du travail, photographie
le tout, puis l'application relit le QR code et copie chaque photo sous le nom
`Prénom_date_numéro.jpg`, dans un sous-dossier par enfant.

**Rien à installer. Aucune ligne de commande. Rien n'est envoyé sur Internet :
tout le traitement se fait dans le navigateur, sur l'ordinateur de la maîtresse.**

---

## Pourquoi du HTML/JS et pas Python ni Go

La contrainte principale est « une maîtresse, un PC Windows, pas de ligne de
commande ». C'est elle qui décide de la technologie :

| | Python | Go | **Page web statique** |
|---|---|---|---|
| Installation | Python + dépendances, ou un `.exe` PyInstaller de 60–150 Mo | un `.exe` de ~10 Mo à copier | **rien, une adresse à mettre en favori** |
| Lancement | double-clic sur un `.exe` → alerte SmartScreen / antivirus | idem | **on clique sur le favori** |
| Mise à jour | renvoyer un nouvel `.exe` à chaque correction | idem | **`git push`, elle recharge la page** |
| Hébergement | — | — | **GitHub Pages, gratuit** |
| Lecture du QR | pyzbar/OpenCV | gozxing | `BarcodeDetector` du navigateur, sinon jsQR |
| Écriture des fichiers | libre | libre | dossier choisi par l'utilisatrice (Edge/Chrome) |

Le seul vrai avantage de Python ou Go serait l'accès libre au disque. Or depuis
2021 les navigateurs Chromium savent le faire : l'API **File System Access**
permet de choisir un dossier et d'y écrire, après un clic explicite de
l'utilisatrice. C'est exactement le besoin ici, sans serveur local ni exécutable
à faire passer l'antivirus de l'école.

Deux points qui ont fait pencher la balance :

- **Pas d'OCR.** Le prénom n'est pas lu sur l'étiquette : il est *dans* le QR code.
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
2. `Settings` → `Pages` → *Source* : **Deploy from a branch**, branche `main`,
   dossier `/ (root)`.
3. Au bout d'une minute, le site est à l'adresse
   `https://<utilisateur>.github.io/qr-school/`.
4. Envoyer cette adresse à la maîtresse et lui faire mettre un favori sur le
   bureau.

HTTPS est indispensable (l'API d'accès aux dossiers ne fonctionne pas en
`file://`), et GitHub Pages le fournit d'office.

---

## Mode d'emploi

### 1. Créer les étiquettes (une fois par an)

Page **Créer les étiquettes** : taper la liste des prénoms, un par ligne, choisir
le nombre d'étiquettes par enfant, cliquer sur *Générer* puis *Imprimer*.

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

1. *Choisir le dossier des photos* → le dossier de la carte SD ou du téléphone.
2. *Choisir le dossier de destination* → par exemple `Documents\Travaux 2026`.
3. *Analyser les photos* → chaque QR code est lu, un tableau s'affiche avec la
   vignette, le prénom trouvé et le futur nom de fichier.
4. Corriger éventuellement les prénoms manquants (surlignés en jaune) : soit en
   tapant dans la case, soit avec le bouton *Compléter les vides avec le prénom
   du dessus* — pratique quand plusieurs photos du même enfant se suivent.
5. *Copier les photos*.

Les photos d'origine ne sont **ni modifiées ni supprimées**, uniquement copiées.
Relancer le rangement deux fois n'écrase rien : la numérotation reprend à la
suite.

---

## Navigateurs

| Navigateur | Résultat |
|---|---|
| Microsoft Edge, Google Chrome (Windows) | tout fonctionne, écriture directe dans le dossier choisi |
| Firefox, Safari | l'analyse fonctionne, mais les photos renommées arrivent une par une dans « Téléchargements », sans sous-dossiers |

Edge étant installé par défaut sur Windows, c'est le choix à recommander.

---

## Détails techniques

- Pas de build, pas de `npm install`, pas de framework : trois pages HTML, deux
  fichiers JS, une feuille de style.
- Lecture des QR : `BarcodeDetector` (natif Chromium) quand il est disponible,
  sinon [jsQR](https://github.com/cozmo/jsQR). L'image est essayée à plusieurs
  tailles (1200, 2000, 3200 px) puis sur quatre zones qui se chevauchent, ce qui
  rattrape les étiquettes petites dans une grande photo.
- Génération des QR : [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator),
  avec l'extension UTF-8 pour les prénoms accentués.
- L'orientation EXIF est prise en compte (`imageOrientation: 'from-image'`), donc
  les photos prises en portrait sont lues correctement.
- Les caractères interdits sous Windows (`< > : " / \ | ? *`) sont retirés des
  noms de fichiers ; les accents et les traits d'union sont conservés.
- Bibliothèques embarquées dans `vendor/` (aucun CDN) : le site continuerait de
  fonctionner hors ligne s'il était copié sur le disque et servi en HTTPS.

## Limites connues (v1)

- Les fichiers **HEIC/HEIF** (iPhone par défaut) ne sont pas lisibles par le
  navigateur ; ils sont listés et signalés comme tels. Régler l'iPhone sur
  « Le plus compatible » (JPEG), ou prévoir une conversion.
- Un seul QR code par photo est utilisé (le premier trouvé).
- Le déplacement (au lieu de la copie) n'est pas proposé, volontairement.
- Les dossiers choisis ne sont pas mémorisés d'une session à l'autre.
