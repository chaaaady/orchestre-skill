---
skill: v0-dev
version: "1.0"
applies_to: [nextjs, react]
inject_when: [ui-generation]
---

# v0.dev — Génération UI assistée

## Qu'est-ce que v0.dev
v0.dev (Vercel) est un générateur de composants UI en langage naturel. Il produit du JSX/TSX avec Tailwind + shadcn/ui. Score Orchestre : 7/10 (conditionnel).

## Quand l'utiliser dans Orchestre

### ✅ Cas d'usage valides
- Générer un composant UI complexe rapidement (timeline, data table, kanban)
- Prototyper une landing page ou un onboarding flow
- Générer des skeletons / loading states élaborés
- Composants stateless sans logique métier

### ❌ Ne pas utiliser pour
- Les composants qui font du data fetching (Server Actions, queries)
- Les formulaires connectés à une Server Action (utiliser rhf-zod.md à la place)
- Tout composant nécessitant du contexte projet spécifique (auth, RLS, etc.)

## Workflow d'intégration dans Orchestre

### 1. Générer sur v0.dev
Prompt type : "Crée un composant [description] avec Tailwind CSS et shadcn/ui. Style minimaliste, responsive, TypeScript strict."

### 2. Adapter au design system Orchestre
Après génération, remplacer **obligatoirement** les couleurs littérales :

```bash
# Remplacements automatiques (exemples)
text-blue-600   → text-primary
bg-blue-600     → bg-primary
text-gray-500   → text-muted-foreground
text-gray-900   → text-foreground
border-gray-200 → border-border
bg-gray-50      → bg-input
text-red-600    → text-destructive
text-green-600  → text-success
```

### 3. Déplacer dans la bonne structure
```
components/
  ui/           ← composants génériques (boutons, badges, cards)
  [feature]/    ← composants spécifiques à une feature (InvoiceCard, etc.)
```

### 4. Vérifier la conformité Orchestre
```
- [ ] Pas de logique métier dans le composant
- [ ] Pas de fetch/query directe
- [ ] Props typées avec z.infer<> ou types Zod
- [ ] Couleurs remplacées par tokens sémantiques
- [ ] Pas de 'use client' inutile
```

## Prompt templates pour v0.dev

### Landing page section
```
Crée une section hero pour un SaaS B2B français.
- Design minimaliste, fond blanc
- Titre H1, sous-titre, CTA principal et secondaire
- Tailwind CSS uniquement, pas de CSS inline
- Responsive (mobile-first)
- TypeScript avec props interface
- Couleurs : utilise des classes génériques (primary, muted) que je remplacerai
```

### Dashboard card
```
Crée un composant Card pour afficher une facture avec :
- Montant, nom client, statut (badge coloré), date d'échéance
- 2 boutons d'action (Marquer payé, Annuler)
- État loading avec skeleton
- TypeScript strict, pas de logique métier
```

### Data table
```
Crée une table de données paginée avec :
- Colonnes triables, filtres
- Pagination (prev/next + numéros)
- État vide personnalisable
- shadcn/ui Table component
- TypeScript générique <T>
```

## Limitations connues

- v0.dev génère souvent des couleurs hardcodées → toujours adapter au design system
- Les composants v0.dev sont souvent Client Components par défaut → vérifier si Server Component possible
- Peut générer des `useState` inutiles → supprimer si Server Component suffit
- Ne génère pas de logique métier correcte (mutations, Server Actions) → ajouter manuellement

## Score conditionnel (7/10)

Utiliser v0.dev quand :
- Le composant est purement visuel (7/10 → recommandé)
- Le projet est en phase de validation UI rapide (3 projets prod minimum avant d'intégrer dans le workflow standard)

Ne pas utiliser quand :
- Le composant contient de la logique (utiliser les skill cards rhf-zod, supabase-patterns, stripe-billing)
- En production avec des contraintes de sécurité strictes (vérifier chaque ligne générée)
