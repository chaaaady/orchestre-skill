# Design Quality — Brand Book Orchestre V15
> Ce fichier est un brand book strict. Non-négociable. Toute génération de composant UI doit s'y conformer.
> Mis à jour : 2026-03-15 (V15.3)

---

## Section 1 — Anti-patterns interdits (AI generic design à bannir)

> Si tu génères l'un de ces patterns, STOP et corrige avant de continuer.

### 1.1 Card soup — Cartes partout
**Pourquoi interdit :** Les cartes partout signalent "AI-generated". Elles ajoutent du bruit visuel et noient la hiérarchie. Chaque card demande l'attention — quand tout est une card, rien n'est important.

**Alternative obligatoire :** Whitespace généreux + séparateurs `border-border` + sections définies par le fond, pas par des bordures. Réserver les cards aux entités cliquables distinctes (un item de liste, une intégration).

---

### 1.2 Gradient bleu-violet en hero
**Pourquoi interdit :** C'est le signature visuel des templates Tailwind 2022. Reconnaissable immédiatement comme générique. Aucune identité de marque possible.

**Alternative obligatoire :** Couleur unie `bg-background` ou `bg-primary` pur. Texture subtile (grain CSS, pattern SVG minimal). Ou dark background avec accent très concentré (1 élément, pas le fond entier).

---

### 1.3 Border-radius identique partout
**Pourquoi interdit :** `rounded-lg` sur tous les éléments = template par défaut shadcn. Perd la capacité à communiquer la hiérarchie sémantique par la forme.

**Alternative obligatoire :** Hiérarchie de radius stricte :
- `rounded-none` ou `rounded-sm` → tableaux de données, inputs, tags techniques
- `rounded-md` → modals, popovers, tooltips
- `rounded-lg` → cards d'entités principales
- `rounded-full` → avatars, badges de statut, boutons pill

---

### 1.4 Sidebar grise + contenu blanc
**Pourquoi interdit :** Combo par défaut de tout SaaS généré depuis un template. Aucune identité possible. Le cerveau le lit comme "dashboard générique".

**Alternative obligatoire :** Définir une vraie palette de surface dans `globals.css`. Options viables : sidebar même fond que contenu (séparation par border) ; sidebar très dark sur fond clair ; sidebar colorée avec tokens dédiés `--color-surface-nav`, `--color-surface-content`.

---

### 1.5 Trop d'éléments en compétition visuelle
**Pourquoi interdit :** Plus de 3 éléments actifs simultanément = bruit cognitif. L'utilisateur ne sait pas où regarder. L'IA génère des pages "complètes" mais visuellement paralysantes.

**Alternative obligatoire :** Max 3 éléments actifs par vue. Règle de priorité : 1 CTA primaire, 1 section informationnelle principale, 1 navigation contextuelle. Tout le reste est secondaire ou caché.

---

### 1.6 Icônes + texte gris systématiquement
**Pourquoi interdit :** Chaque label avec une icône à gauche + texte muted = pattern "AI sidebar". Surcharge visuelle et ajoute du bruit sans valeur sémantique.

**Alternative obligatoire :** Choisir l'un des deux selon le contexte :
- **Icônes seules** (avec tooltip) → navigation compacte, actions secondaires
- **Texte seul** → contenu principal, labels de formulaire, descriptions
- **Icône + texte** → uniquement pour les CTAs principaux et les items de navigation primaire (pas pour les listes de contenu)

---

### 1.7 Boutons outline et filled mélangés sans logique
**Pourquoi interdit :** Mélange arbitraire = aucune hiérarchie perceptible. L'utilisateur ne distingue pas ce qui est prioritaire.

**Alternative obligatoire — Hiérarchie stricte :**
- **Primary** (`bg-primary text-primary-foreground`) → 1 seul par vue, action principale
- **Secondary** (`bg-muted text-foreground border border-border`) → actions importantes mais non-prioritaires
- **Ghost** (`bg-transparent hover:bg-muted`) → actions tertiaires, navigation, annulation
- **Destructive** (`bg-destructive text-destructive-foreground`) → suppressions, uniquement après confirmation

---

### 1.8 Typography sans hiérarchie
**Pourquoi interdit :** Tous les textes à `text-sm text-gray-500` = lisibilité catastrophique et design générique. La typographie EST la hiérarchie.

**Alternative obligatoire — Scale stricte :**
- Titre page : `text-2xl font-semibold tracking-tight text-foreground`
- Titre section : `text-lg font-medium text-foreground`
- Corps principal : `text-sm text-foreground`
- Corps secondaire : `text-sm text-muted-foreground`
- Caption/label : `text-xs text-muted-foreground`
- **Max 3 niveaux par contexte. Jamais de `text-xl` et `text-2xl` dans la même section.**

---

### 1.9 Spacing inconsistant
**Pourquoi interdit :** Des valeurs de spacing arbitraires (`mt-3`, `pb-7`, `gap-5`) créent une incohérence sublimale que le cerveau perçoit comme "pas fini" ou "généré".

**Alternative obligatoire — Scale Tailwind exclusive :**
Utiliser uniquement : `4` (16px) · `8` (32px mais aussi 2rem) · `12` · `16` · `24` · `32` · `48` · `64`

En pratique :
- Entre éléments liés (label + input) : `gap-2` (8px)
- Entre composants d'une même section : `gap-4` (16px)
- Entre sections d'une page : `py-8` ou `py-12` (32-48px)
- Padding de section : `px-6 py-8` minimum
- **Interdit : `mt-3`, `gap-5`, `p-7`, `mb-9`, etc.**

---

### 1.10 Couleurs accent utilisées partout
**Pourquoi interdit :** Quand la couleur primaire est sur les boutons, les icônes, les badges, les liens et les graphes simultanément — elle perd toute valeur de signal. Tout est important = rien n'est important.

**Alternative obligatoire :**
- 1 seul accent (défini dans `--color-primary`)
- Utilisé sur **20% maximum** des éléments visibles par écran
- Réservé aux : CTA primaire, état actif de navigation, progress/statut positif
- Badges et tags → `bg-muted text-muted-foreground` par défaut, accent uniquement pour statuts critiques

---

## Section 2 — Rules obligatoires

> Ces règles s'appliquent à CHAQUE composant généré. Aucune exception.

### R1 — Référence visuelle obligatoire
Le champ `design_inspiration` dans `PROJECT.md` est **obligatoire avant toute génération UI**.
- Format attendu : `design_inspiration: "linear"` ou `"stripe"` ou `"vercel"` ou `"resend"` ou URL de référence
- Si absent → **STOP. Demander avant de générer le moindre composant.**
- Ce champ détermine le fingerprint visuel cible (voir Section 3)

### R2 — Whitespace minimum
- Padding sections : `px-6 py-8` minimum (24px/32px)
- Entre éléments liés (dans même groupe) : `gap-2` minimum
- Entre groupes distincts : `gap-6` minimum
- Page container : `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`

### R3 — Typography
- Max 2 familles de police par projet (1 sans-serif pour UI, 1 optionnelle mono pour code/métriques)
- Max 3 niveaux de taille par contexte (ne jamais utiliser tous les niveaux de la scale)
- Line-height : `leading-tight` pour titres, `leading-normal` pour corps, jamais de valeur custom
- Jamais de `font-bold` sur du texte secondaire

### R4 — Un seul point focal par écran
- Chaque vue a **exactement 1** élément visuellement dominant
- Hiérarchie visuelle : 1 dominant → 2-3 secondaires → reste tertiaire
- Tester mentalement : "si je squinte les yeux, qu'est-ce que je vois en premier ?"

### R5 — Contraste WCAG AA minimum
- Texte sur fond : ratio 4.5:1 minimum (`text-foreground` sur `bg-background` = obligatoire)
- Texte large (>18px) : ratio 3:1 minimum
- `text-muted-foreground` sur `bg-background` **doit** passer 4.5:1 — vérifier les valeurs HSL
- Jamais de texte sur fond coloré sans vérification de contraste

### R6 — Animations
- Duration : 150ms pour micro-interactions (hover, focus), 200-300ms pour transitions d'état
- Easing : `ease-out` ou `ease-in-out` uniquement
- **Interdit :** bounce (`cubic-bezier` avec overshoot), spring, durées > 400ms
- Classes Tailwind autorisées : `transition-colors duration-150`, `transition-all duration-200`
- Interdit : `animate-bounce` sur des éléments UI fonctionnels

---

## Section 3 — Fingerprints par style

> Quand `design_inspiration` est défini, applique le fingerprint correspondant à la lettre.

### Linear
```
Thème      : dark first (fond #0F0F0F ou équivalent token dark)
Radius     : rounded-none sur les cards, rounded-sm sur les inputs
Métriques  : font-mono pour tous les chiffres, compteurs, IDs
Couleurs   : quasi aucune — fond sombre, texte blanc, 1 accent pourpre/violet très discret
Borders    : 1px solid, très subtiles (opacity 15-20%)
Density    : dense, compact, padding réduit (gap-2 à gap-4)
Shadows    : aucune shadow — jamais de drop-shadow
Hiérarchie : par luminosité du texte uniquement (foreground > muted > très muted)
```

### Stripe
```
Thème      : light first, palette ultra-neutre (gris froids)
Typography : seul élément de hiérarchie — tailles et poids, pas les couleurs
Data       : dense, tableaux, grilles — Stripe affiche beaucoup en peu d'espace
Trust      : badges "Verified", certifications, logos partenaires visibles
Radius     : rounded-md partout, très cohérent
Couleurs   : blanc + gris + 1 violet très discret pour les actions
Hover      : transitions subtiles sur les rows de tableau
Prix/chiffres : toujours prominents, grande taille, font-tabular-nums
```

### Vercel
```
Thème      : blanc pur ou noir pur — pas de gris milieu
Contraste  : extrême — black/white, rien entre les deux
Borders    : grises, très subtiles — `border-border` avec opacity faible
Micro-anim : présents sur les hovers (translate-y-0.5, opacity changes)
Radius     : rounded-lg sur containers, rounded-md sur éléments
Icônes     : minimalistes, stroke uniquement, épaisseur uniforme
État actif : bg-black text-white (light) / bg-white text-black (dark)
Whitespace : généreux — Vercel "respire"
```

### Resend
```
Thème      : dark mode excellent — fond quasi-noir, pas de bleu sombre
Developer  : code snippets bien stylés avec syntax highlighting sobre
Couleurs   : sobres — vert doux pour succès, rouge pour erreurs, le reste neutral
Typography : claire, lisible, priorité au contenu technique
Radius     : `rounded-md` cohérent, jamais `rounded-full` sur les containers
Code       : `font-mono text-sm bg-muted rounded-sm px-1.5 py-0.5` pour inline
Dark mode  : les deux thèmes sont de qualité égale — pas un dark mode "ajouté après"
CTAs       : sobres, pas de gradient, filled simple
```

---

## Section 4 — Checklist review (10 questions)

> Exécuter après chaque génération de composant ou de page. Score < 7/10 = FAIL.

| # | Question | Verdict attendu |
|---|----------|-----------------|
| Q01 | Peut-on identifier le secteur d'activité sans lire le texte ? | OUI → passe |
| Q02 | Y a-t-il plus de 3 couleurs visibles simultanément sur un écran ? | NON → passe |
| Q03 | Le spacing est-il issu uniquement de la scale Tailwind (4,8,12,16,24,32,48,64) ? | OUI → passe |
| Q04 | Y a-t-il un point focal clair par vue (1 élément dominant) ? | OUI → passe |
| Q05 | Les boutons suivent-ils la hiérarchie primary → secondary → ghost ? | OUI → passe |
| Q06 | La hiérarchie typographique est-elle visible à 2 mètres (titre vs corps) ? | OUI → passe |
| Q07 | Y a-t-il des éléments décoratifs sans purpose fonctionnel ou narratif ? | NON → passe |
| Q08 | Ce design ressemble-t-il à n'importe quel autre SaaS générique ? | NON → passe |
| Q09 | Le whitespace est-il intentionnel et cohérent (pas de gaps aléatoires) ? | OUI → passe |
| Q10 | Un concurrent pourrait-il utiliser ce design sans changement identitaire ? | NON → passe |

**Score :**
- 10/10 → Design professionnel
- 8-9/10 → Bon, corrections mineures
- 7/10 → Acceptable, revoir les échecs
- < 7/10 → **FAIL** — lister les questions échouées et corriger avant de livrer

---

## Références

- Linear design language : [linear.app](https://linear.app) — inspecter les DevTools pour les valeurs exactes
- Stripe design system : [stripe.com/docs](https://stripe.com/docs) + [dashboard.stripe.com](https://dashboard.stripe.com)
- Vercel Geist : [vercel.com/design](https://vercel.com/design)
- Resend : [resend.com/docs](https://resend.com/docs) + [resend.com/emails](https://resend.com/emails)

---

## Design System Rules

> Règles d'implémentation des tokens CSS. Un composant ne doit JAMAIS connaître les couleurs du projet — il utilise des tokens sémantiques. Les couleurs réelles sont définies UNE SEULE FOIS dans `globals.css`.

### Structure obligatoire dans l'INIT

#### globals.css
```css
:root {
  --color-primary: {PRIMARY_HEX};
  --color-primary-hover: {PRIMARY_HOVER_HEX};
  --color-primary-foreground: #FFFFFF;
  --color-destructive: #DC2626;
  --color-destructive-foreground: #FFFFFF;
  --color-success: var(--color-primary);
  --color-warning: #D97706;
  --color-background: #FFFFFF;
  --color-foreground: #111827;
  --color-muted: #6B7280;
  --color-muted-foreground: #9CA3AF;
  --color-border: #E5E7EB;
  --color-input: #F9FAFB;
}
.dark {
  --color-background: #0F172A;
  --color-foreground: #F8FAFC;
  --color-muted: #94A3B8;
  --color-muted-foreground: #64748B;
  --color-border: #1E293B;
  --color-input: #1E293B;
}
```

#### tailwind.config.ts
```ts
darkMode: ['class', '[data-theme="dark"]'],
theme: {
  extend: {
    colors: {
      primary: { DEFAULT: 'var(--color-primary)', hover: 'var(--color-primary-hover)', foreground: 'var(--color-primary-foreground)' },
      destructive: { DEFAULT: 'var(--color-destructive)', foreground: 'var(--color-destructive-foreground)' },
      success: 'var(--color-success)',
      warning: 'var(--color-warning)',
      background: 'var(--color-background)',
      foreground: 'var(--color-foreground)',
      muted: { DEFAULT: 'var(--color-muted)', foreground: 'var(--color-muted-foreground)' },
      border: 'var(--color-border)',
      input: 'var(--color-input)',
    }
  }
}
```

### Tokens disponibles dans les composants

| Token | Usage |
|-------|-------|
| `text-primary` | Actions, liens, CTA |
| `text-muted-foreground` | Texte secondaire |
| `text-foreground` | Texte principal |
| `text-destructive` | Erreurs |
| `text-success` | Succès |
| `bg-primary` | Boutons principaux |
| `bg-destructive` | Boutons danger |
| `bg-muted` | Backgrounds secondaires |
| `border-border` | Séparateurs |

### ✅ Autorisé
```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary-hover">
<p className="text-muted-foreground">
<div className="border-border bg-input">
```

### ❌ Interdit
```tsx
<button className="bg-green-600 text-white">    // couleur littérale
<p className="text-gray-500">                   // neutral littéral
<div style={{ color: '#16A34A' }}>              // hex inline
```

> **Wave 4 scoring :** Chaque `hardcoded_color` = -1pt sur le score Design System. Chaque `duplicate_route` = -5pts. Chaque `naming_violation` = -2pts.
