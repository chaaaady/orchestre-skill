# Naissance

20 secondes d'animation à l'encre et au pinceau, entièrement dessinées en JavaScript sur un `<canvas>`.
Aucune image, aucun asset : seule la police manuscrite « Caveat » vient de Google Fonts.

**day 0 (0-10 s)** : une goutte d'encre tombe, éclate, rampe et se dresse en silhouette. Elle se retrouve au bout
d'un couloir d'étagères immense, marche vers une fente de lumière qui dévore tout, et la page affiche « day 1 ».

**day 1 (10-20 s)** : une goutte tombe du dernier éclat et trace l'horizon. La silhouette se redessine, un ensō
devient le soleil, les montagnes et les oiseaux apparaissent. Elle marche, une plante pousse à chacun de ses pas,
puis elle salue le soleil pendant que la caméra recule.

## Aperçu

Ouvrez `index.html` dans un navigateur (il faut une connexion pour la police), ou servez le dossier :

```bash
npm run preview          # http://localhost:8080
```

- **Espace** : lecture / pause · **← →** : image par image · barre de défilement : aller à une image
- `index.html?frame=120` ouvre l'aperçu en pause sur l'image 120
- `index.html?test` affiche la page de test du moteur de pinceau

## Refaire le rendu

```bash
npm install              # Puppeteer (+ ffmpeg-static si ffmpeg n'est pas installé)
npm run render           # = node render.mjs
```

Le script attend `document.fonts.ready`, rend les 480 images en PNG via `canvas.toDataURL`
(`deviceScaleFactor` 1) dans `out/frames/`, puis les assemble avec ffmpeg :

- `out/scene.mp4` : 1920×1080, 24 i/s, 20 s, H.264, yuv420p, crf 18
- `out/contact.png` : planche contact de 12 images réparties sur les 20 s

Options :

- `node render.mjs --frames 36,100-104` rend seulement ces images dans `out/keys/`, sans vidéo
- `node render.mjs --test` rend la page de test dans `out/test.png`
- `PUPPETEER_EXECUTABLE_PATH=/chemin/vers/chrome` pour utiliser un Chrome ou Chromium déjà installé

Le rendu prend environ 4 min. Le plan du couloir est le plus lourd (environ 0,2 s par image).

## Où modifier la scène

Tout est dans `index.html`, en JS vanilla :

| Section | Contenu |
|---|---|
| `MOTEUR DE PINCEAU` | `inkStroke`, `drawOn`, `inkFill`, `splatter`, `handText`, `blob` |
| `PAPIER` | grain, fibres et « dent » du papier, générés une fois hors écran |
| `CAMÉRA` | `applyCam` (translate, scale, rotate) et `shake` |
| `SCÈNE « NAISSANCE »` | un bloc par plan, puis la timeline `SHOTS` |

- **Timeline** : le tableau `SHOTS` en bas de la section scène liste les plans `{ start, end, draw(ctx, t) }`
  en secondes. `t` va de 0 à 1 dans le plan.
- **Plans day 0** : `shotPage` (page et goutte), `shotImpact`, `shotBirth` (la silhouette se forme),
  `shotCorridor`, `shotLight` (le cône de lumière), `shotDay1`.
- **Plans day 1** : `shotHorizon` (le titre rejoint son cadre, l'horizon se trace), puis `shotWorld` pour les
  trois derniers plans, qui forment une seule scène continue pilotée par le temps (`camDay1`, `WALK`, `GROW1`).
- **Réglages rapides** : `IMPACT` (point d'impact), `CRAWLERS` (les 7 gouttes qui deviennent le corps),
  `figurePose` (posture de la silhouette), `COR` (dimensions du couloir, focale, fente), `CAM4` et `CAM5`
  (avancée de la caméra), `DAY1`, `HZ` (horizon), `RIDGES` (montagnes), `SPROUTS` (ce qui pousse à chaque pas),
  `BIRDS`.
- **Palette** : `INK` (#111111) et `PAPER` (#ECE7DC). Un plan qui renvoie `{ invert: true }` inverse les couleurs.

Règles du code : `renderFrame(n)` redessine tout à partir de zéro, et le même `n` donne toujours la même image.
Tout l'aléatoire passe par `mulberry32` et `noise2`, jamais par `Math.random()`. Le tremblement des traits
(« boiling line ») change de graine toutes les 3 images, via `S.boil`.
