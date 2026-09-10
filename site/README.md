# Site personnel — Chady Emara

Site statique, 3 pages, zéro dépendance. Structure thought-leader pour positionner Orchestre et l'angle "gouvernance des agents IA".

## Structure

```
site/
├── index.html              # Home : problèmes, approche, preuves, articles, work, contact
├── manifesto.html          # Long-form "Cognitive OS" (~2500 mots)
└── articles/
    └── budget-kill.html    # Article flagship (~1500 mots) avec code reproductible
```

## Déploiement Vercel (10 min, gratuit)

1. Depuis la racine du repo :
   ```bash
   cd site
   npx vercel --prod
   ```
2. Accepter les défauts (framework: Other, build: none).
3. Choisir un domaine custom dans le dashboard Vercel → Settings → Domains.

## Déploiement Netlify (alternative)

```bash
cd site
npx netlify deploy --prod --dir .
```

## Test local

```bash
cd site
python3 -m http.server 8000
# ouvrir http://localhost:8000
```

## Editing guidelines

- Palette : `--bg #0f1218`, `--accent #f5c563` (or doré), `--text #e8ecf4`.
- Police : Inter / SF Pro via system stack, SF Mono pour le code.
- Largeur lecture : `max-width: 720px` sur les articles, `1040px` sur la nav et les grilles.
- Chaque article reprend la même nav + footer inline — si tu modifies la nav, pense à le faire dans les 3 fichiers.

## Prochains articles à écrire (ordre de priorité)

1. **Pourquoi vos agents oublient leurs erreurs (et comment on corrige ça en 50 lignes)** — sur la memory d'échecs d'Orchestre.
2. **EU AI Act & agents : les 3 artefacts que vous devrez produire en 2027** — angle conformité, ciblé CTOs / DPOs.
3. **Haiku + Orchestre vs Opus nu : le benchmark qui change la donne** — publication du benchmark reproductible.

Chacun de ces articles peut réutiliser le template `articles/budget-kill.html` (copier, renommer, remplacer le contenu de `<article>`).

## Custom domain suggestions

- `chady.dev`
- `chady.io`
- `chadyemara.com`
- `orchestre.dev` (si tu veux séparer site perso / site produit)

## SEO basique

Chaque page a un `<title>` et une `<meta description>`. Pour aller plus loin :
- Ajouter Open Graph tags (`og:title`, `og:description`, `og:image`)
- Ajouter un `sitemap.xml` (3 URLs)
- Soumettre le sitemap à Google Search Console
