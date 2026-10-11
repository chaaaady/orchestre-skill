# Naissance

10 secondes d'animation à l'encre et au pinceau, entièrement dessinées en JavaScript sur un `<canvas>`.
Aucune image, aucun asset : seule la police manuscrite « Caveat » vient de Google Fonts.

Une goutte d'encre tombe, éclate, rampe et se dresse en silhouette. Elle se retrouve au bout d'un couloir
d'étagères immense, marche vers une fente de lumière qui dévore tout, et la page affiche « day 1 ».

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

Le script attend `document.fonts.ready`, rend les 240 images en PNG via `canvas.toDataURL`
(`deviceScaleFactor` 1) dans `out/frames/`, puis les assemble avec ffmpeg :

- `out/scene.mp4` : 1920×1080, 24 i/s, 10 s, H.264, yuv420p, crf 18
- `out/contact.png` : planche contact de 12 images réparties sur les 10 s

Options :

- `node render.mjs --frames 36,100-104` rend seulement ces images dans `out/keys/`, sans vidéo
- `node render.mjs --test` rend la page de test dans `out/test.png`
- `PUPPETEER_EXECUTABLE_PATH=/chemin/vers/chrome` pour utiliser un Chrome ou Chromium déjà installé

Le rendu prend environ 1 min 30. Le plan du couloir est le plus lourd (environ 0,2 s par image).

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
- **Plans** : `shotPage` (page et goutte), `shotImpact`, `shotBirth` (la silhouette se forme),
  `shotCorridor`, `shotLight` (le cône de lumière), `shotDay1`.
- **Réglages rapides** : `IMPACT` (point d'impact), `CRAWLERS` (les 7 gouttes qui deviennent le corps),
  `figurePose` (posture de la silhouette), `COR` (dimensions du couloir, focale, fente), `CAM4` et `CAM5`
  (avancée de la caméra), `DAY1`.
- **Palette** : `INK` (#111111) et `PAPER` (#ECE7DC). Un plan qui renvoie `{ invert: true }` inverse les couleurs.

Règles du code : `renderFrame(n)` redessine tout à partir de zéro, et le même `n` donne toujours la même image.
Tout l'aléatoire passe par `mulberry32` et `noise2`, jamais par `Math.random()`. Le tremblement des traits
(« boiling line ») change de graine toutes les 3 images, via `S.boil`.
