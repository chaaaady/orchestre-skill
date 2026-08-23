# CV — Farah Elbid

Site de candidature (CV + lettre de motivation) pour Farah Elbid, directrice adjointe du marketing digital.

## Stack

- **Next.js 16** (App Router, Server Components par défaut, export statique)
- **Tailwind CSS v4** avec tokens sémantiques uniquement (`bg-background`, `text-brand`…)
- **shadcn/ui** (new-york) — `Button`, `Card`, `Badge`, `Separator` dans `components/ui/`
- **Typographie mixte** : `Instrument Serif` (display, citations, chiffres) + `Inter` (UI, texte courant)
- Thème clair/sombre persisté en `localStorage`, sans flash au chargement

## Démarrer

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # build de production (100 % statique)
```

## Structure

```
app/            routes : / (CV), /lettre, 404, favicon
components/ui/  primitives shadcn
components/cv/  sections du site (hero, timeline, compétences, contact…)
lib/data/cv.ts  contenu du CV — schémas Zod + données
public/         CV en PDF téléchargeable
```

Tout le contenu éditorial vit dans `lib/data/cv.ts` : modifier ce fichier suffit à mettre le site à jour.

## À compléter

- `LINKEDIN_URL` dans `lib/data/cv.ts` pointe vers `https://www.linkedin.com/` — remplacer par l'URL exacte du profil.

## Déploiement

Le site est entièrement statique : déployable sur Vercel (`vercel --prod`), Netlify ou tout hébergeur Node.
