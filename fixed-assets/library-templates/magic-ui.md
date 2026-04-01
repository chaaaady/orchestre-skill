# SKILL: Magic UI
> Module ID: `ui-magicui` | Domaine: Frontend / Animation | Stack: Next.js App Router + Tailwind

## Install
```bash
npx magicui-cli@latest init
npx magicui-cli@latest add animated-beam
npx magicui-cli@latest add border-beam
npx magicui-cli@latest add magic-card
npx magicui-cli@latest add number-ticker
npx magicui-cli@latest add animated-list
npx magicui-cli@latest add marquee
npx magicui-cli@latest add shimmer-button
npx magicui-cli@latest add sparkles-text
npx magicui-cli@latest add typing-animation
npx magicui-cli@latest add word-fade-in
```

## Exports clés
- `AnimatedBeam` — ligne animée entre deux refs
- `BorderBeam` — bordure lumineuse animée sur card
- `MagicCard` — card avec effet spotlight au hover
- `NumberTicker` — compteur animé de 0 à N
- `AnimatedList` — liste avec entrées échelonnées
- `Marquee` — défilement horizontal infini
- `ShimmerButton` — bouton CTA avec effet shimmer
- `SparklesText` — texte avec particules scintillantes
- `TypingAnimation` — effet machine à écrire
- `WordFadeIn` — apparition mot par mot

## Pattern principal
```tsx
// Chaque composant est copié localement dans @/components/magicui/
// Import direct depuis le dossier local

import { MagicCard } from "@/components/magicui/magic-card"
import { NumberTicker } from "@/components/magicui/number-ticker"
import { BorderBeam } from "@/components/magicui/border-beam"

export function StatsCard({ value, label }: { value: number; label: string }) {
  return (
    <MagicCard
      className="relative flex flex-col items-center p-6"
      gradientColor="#262626"
    >
      <BorderBeam size={80} duration={8} />
      <NumberTicker
        value={value}
        className="text-4xl font-bold tabular-nums"
      />
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </MagicCard>
  )
}
```

## Patterns secondaires

**Marquee pour social proof :**
```tsx
import { Marquee } from "@/components/magicui/marquee"

<Marquee pauseOnHover className="[--duration:20s]">
  {testimonials.map((t) => <TestimonialCard key={t.id} {...t} />)}
</Marquee>
```

**AnimatedBeam pour visualiser des connexions :**
```tsx
// Nécessite des refs sur les éléments source et target
const containerRef = useRef<HTMLDivElement>(null)
const fromRef = useRef<HTMLDivElement>(null)
const toRef = useRef<HTMLDivElement>(null)

<AnimatedBeam containerRef={containerRef} fromRef={fromRef} toRef={toRef} />
```

**Hero avec SparklesText + TypingAnimation :**
```tsx
<SparklesText text="Votre titre accrocheur" className="text-6xl font-bold" />
<TypingAnimation className="text-xl text-muted-foreground" duration={50}>
  Sous-titre qui s'écrit progressivement
</TypingAnimation>
```

## Gotchas
- **Les composants sont copiés localement** — pas importés depuis npm. `npx magicui-cli add` génère les fichiers dans `@/components/magicui/`. Modifier directement si besoin de customisation.
- **Client Components obligatoires** — tous les composants MagicUI utilisent des hooks/animations. Ils s'utilisent uniquement dans des `'use client'` ou dans des composants leaf de Server Components.
- **AnimatedBeam** nécessite un `containerRef` avec `position: relative` sur le parent.
- **MagicCard** `gradientColor` : utiliser une couleur sombre en dark mode, claire en light mode.

## À NE PAS FAIRE
- Ne pas essayer d'importer depuis `magicui` comme package npm (ça n'existe pas en tant que tel)
- Ne pas utiliser dans des Server Components directement — toujours dans `'use client'`
- Ne pas wrapper NumberTicker dans Suspense inutilement — il gère son propre état
- Ne pas cumuler plus de 3 animations MagicUI sur un même écran (performance + lisibilité)
