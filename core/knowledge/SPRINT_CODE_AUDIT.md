# SPRINT — Code Audit : Vibe-to-Serious

## Objectif
Transformer un repo fonctionnel mais anarchique en base de code maintenable.
7 passes séquentielles, chacune avec critères de succès mesurables.

**Score cible : 85/100 minimum avant de continuer à builder.**

---

## Contexte à fournir avant d'exécuter
- Repo cible : `[CHEMIN_REPO]`
- Stack principale : `[Next.js / Node / Python / autre]`
- Périmètre : `[tout le repo / dossier src/ / service X]`
- Fichier le plus heureux à rewrite : `[optionnel, sinon Claude choisit]`

---

## Passe 1 — Dead Code Removal

**Mission :** Supprimer tout ce qui ne sert pas.

```
Analyse l'intégralité du repo. Identifie et supprime :
- Fonctions/méthodes jamais appelées
- Fichiers importés nulle part
- Variables déclarées mais inutilisées
- Commentaires de code mort (blocs entiers commentés)
- Imports inutilisés (lint + analyse manuelle)
- Routes/endpoints non utilisés

Pour chaque suppression :
- Vérifie qu'aucun test ne l'utilise
- Vérifie qu'aucun fichier externe ne l'importe
- Note dans un commentaire de commit ce qui a été retiré et pourquoi

Critère de succès : 0 import inutilisé, 0 fonction orpheline, bundle size réduit ou stable.
```

---

## Passe 2 — Folder Restructure

**Mission :** Organiser les dossiers selon la logique métier.

```
Analyse la structure actuelle et propose une reorganisation :
- Regrouper par domaine (auth/, invoices/, users/, etc.) pas par type (models/, controllers/)
- Respecter les conventions du framework détecté (Next.js App Router, Express, etc.)
- Créer un fichier index.ts par dossier si plusieurs exports
- Déplacer les fichiers, mettre à jour TOUS les imports automatiquement

Règles :
- Ne jamais casser un import sans le corriger immédiatement
- Vérifier que le build passe après chaque déplacement de fichier

Critère de succès : `npm run build` passe, 0 import cassé, structure lisible en < 10s.
```

---

## Passe 3 — Hardcoded Value Extraction

**Mission :** Zéro valeur en dur dans le code.

```
Cherche et extrait :
- URLs en dur (API endpoints, base URLs)
- Clés, tokens, secrets (même fake/test)
- Délais, limites, seuils numériques (timeouts, max retries, pagination size)
- Messages d'erreur et copy répétés
- Couleurs/styles hardcodés hors du système de design

Action :
- Créer/compléter config.ts ou constants.ts avec les valeurs extraites
- Variables d'environnement → .env.example mis à jour
- Copy répété → fichier i18n ou constants/messages.ts

Critère de succès : grep sur le repo ne trouve aucun hardcode évident.
```

---

## Passe 4 — Naming Standardization

**Mission :** Conventions cohérentes partout.

```
Applique les conventions suivantes (ou détecte celles déjà en place et uniformise) :
- Fichiers : kebab-case pour les modules, PascalCase pour les composants React
- Variables/fonctions : camelCase
- Constantes : UPPER_SNAKE_CASE
- Types/Interfaces : PascalCase, pas de préfixe "I"
- Booléens : préfixe is/has/can/should
- Handlers : préfixe handle (handleSubmit, handleClick)
- Async functions : pas de suffixe Async sauf si coexistence avec version sync

Renomme en masse, mets à jour tous les usages.
Critère de succès : 0 incohérence de casse détectable par ESLint.
```

---

## Passe 5 — Scalability Risks

**Mission :** Identifier et corriger les bombes à retardement.

```
Analyse le code et détecte :
- N+1 queries (boucles qui font des appels DB)
- Appels API sans rate limiting ni retry
- Absence de pagination sur les endpoints qui retournent des listes
- Singletons non protégés (connexions DB instanciées dans chaque requête)
- Mémoire : arrays qui grandissent sans limite
- Crons sans mutex (peuvent tourner en parallèle)
- Secrets dans les logs

Pour chaque risque détecté :
- Catégoriser : CRITIQUE / MODÉRÉ / MINEUR
- Corriger les CRITIQUES immédiatement
- Commenter les MODÉRÉS avec un TODO daté

Critère de succès : 0 risque CRITIQUE non corrigé, liste des MODÉRÉS documentée.
```

---

## Passe 6 — Worst File Rewrite

**Mission :** Identifier et réécrire le fichier le plus problématique.

```
Si non spécifié dans le contexte, identifie le pire fichier selon :
- Nombre de lignes (> 300 lignes = suspect)
- Nombre de responsabilités (viole SRP)
- Complexité cyclomatique
- Nombre de TODO/FIXME/HACK
- Dernière modification (souvent modifié = souvent cassé)

Rewrite complet :
- Découper en sous-modules si nécessaire
- Appliquer les principes SOLID
- Typage complet, 0 any
- JSDoc sur les fonctions publiques
- Tests unitaires pour les fonctions pures extraites

Critère de succès : fichier < 150 lignes OU découpé en modules < 150 lignes chacun.
```

---

## Passe 7 — Documentation

**Mission :** Rendre le repo compréhensible en 5 minutes.

```
Créer ou mettre à jour :

1. README.md racine :
   - Description en 2 phrases
   - Prérequis (Node version, variables d'env requises)
   - Setup en 3 commandes (clone, install, run)
   - Architecture en 1 schéma ASCII ou liste

2. ARCHITECTURE.md (si repo complexe) :
   - Flux de données principaux
   - Décisions techniques clés + justification
   - Ce qui manque / dettes techniques connues

3. Commentaires inline :
   - Supprimer les commentaires évidents ("// incrémente i")
   - Ajouter des commentaires sur le "pourquoi" pas le "quoi"
   - JSDoc sur toutes les fonctions publiques exportées

Critère de succès : un dev junior comprend le projet sans poser de questions.
```

---

## Score final à calculer

Après les 7 passes, évalue chaque passe sur 10 et calcule le score global :

| Passe | Score /10 | Observations |
|-------|-----------|--------------|
| 1. Dead Code | /10 | |
| 2. Folder | /10 | |
| 3. Hardcoded | /10 | |
| 4. Naming | /10 | |
| 5. Scalability | /10 | |
| 6. Rewrite | /10 | |
| 7. Docs | /10 | |
| **Total** | **/70 → /100** | |

**Seuil de validation : 60/70 (85/100)**

---

## Commande d'exécution

```bash
# Depuis le repo cible
claude --dangerously-skip-permissions \
  "Lis SPRINT_CODE_AUDIT.md dans [CHEMIN_VERS_CE_FICHIER]. Exécute les 7 passes dans l'ordre. Avant chaque passe, affiche son nom et son objectif. Après chaque passe, affiche le score /10 et ce qui a été fait. Ne passe pas à la suivante si la build est cassée. À la fin, affiche le tableau de score complet."
```

---

## Notes
- Temps estimé : 20-40 min selon taille du repo
- Prérequis : `npm run build` doit passer avant de commencer
- Committer après chaque passe (messages de commit explicites)
- Si une passe échoue à faire passer le build → rollback et noter le problème
