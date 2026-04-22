# PROMPT : Implémentation --team et Upgrade Next.js 16.2

## Contexte
Le projet `orchestre-skill` doit évoluer pour supporter la collaboration multi-agents via une nouvelle option `--team` et bénéficier des dernières optimisations de Next.js 16.2.

## Objectifs techniques

### 1. Support de l'option `--team`
- Modifier le parseur d'arguments (probablement dans `core/` ou le point d'entrée CLI) pour accepter le flag `--team`.
- Implémenter la logique de session partagée : quand `--team` est activé, l'agent doit pouvoir lire et écrire dans un état global partagé (`shared_state`) plutôt que dans une mémoire isolée.
- Assurer la gestion des verrous (locks) pour éviter les conflits d'écriture entre plusieurs instances d'agents travaillant simultanément sur le même projet.

### 2. Migration Next.js 16.2
- Mettre à jour `package.json` avec `"next": "16.2.0"` et les dépendances associées (`react`, `react-dom`).
- Vérifier et adapter les `next.config.js` pour la compatibilité avec la v16.2 (notamment les changements sur le caching et les server actions).
- Adapter les composants du dossier `web/` ou `app/` si des breaking changes sont détectés dans l'API de Next.js.
- Lancer un `npm install` puis `npm run build` pour valider la migration.

## Livrables attendus
- Code source mis à jour.
- Rapport de tests confirmant que le flag `--team` est bien interprété.
- Build Next.js réussi sans avertissements majeurs.

## Instructions d'exécution
Exécute ce plan de manière séquentielle. Priorise la stabilité de la CLI avant de passer à la mise à jour du framework web.
