# Skill: orchestre-go

## Metadata
- **Name**: orchestre-go
- **Description**: Transforme un prompt libre en projet complet. Génère PROJECT.md, décompose en features, planifie, et génère tout le code.
- **Trigger**: /orchestre-go, "génère un projet", "crée un SaaS", "build me a", "je veux une app"

## Parameters
- `prompt` (required): Description libre du projet
- `--profile` (optional): premium | balanced (default) | budget
- `--parallel` (optional): Active l'exécution parallèle des features

## Process

### PHASE 0 : Discovery (2 minutes)

Tu as reçu un prompt libre. Avant de générer quoi que ce soit, pose **exactement 5 questions** via AskUserQuestion. Pas plus, pas moins.

```
Question 1 : "C'est pour qui ? (persona, secteur, B2B/B2C)"
Question 2 : "LA feature qui tue ? (celle qui différencie ton produit)"
Question 3 : "Paiement ? (gratuit / freemium / payant — abo ou one-shot)"
Question 4 : "Code existant ou from scratch ?"
Question 5 : "Un site qui t'inspire visuellement ? (optionnel, URL ou nom)"
```

Pose les 5 questions EN UNE SEULE AskUserQuestion, formatées clairement.

### PHASE 1 : Génération PROJECT.md (3 minutes)

Avec le prompt initial + les 5 réponses, génère `PROJECT.md` avec cette structure :

```yaml
---
project_id: {slug-from-name}
project_name: {nom}
type: {saas|landing|api|tool}
stack: nextjs-supabase-shadcn
modules: [{auth-supabase}, {payments-stripe si paiement}, {emails-resend}]
mode: {greenfield|brownfield}
design_inspiration: {url si fournie}
---
```

Puis les sections (inférer intelligemment du prompt + réponses) :

- **§0 Executive Snapshot** : One-liner, ICP, JTBD, pricing, différenciateur
- **§1 Vision** : Problème + 3 pain points
- **§3 Outcomes** : Métriques de succès (technique, business, UX)
- **§4 Branding** : Couleurs, font, mode (dark/light), radius — depuis l'inspiration ou défauts par secteur
- **§5 Personas** : 1-3 personas avec droits/rôles
- **§6 User Flows** : 2-5 flows principaux (étapes numérotées)
- **§7 Pages** : Liste des pages avec layout
- **§8 Copy Deck** : Langue, ton, CTAs, messages succès/erreur
- **§9 Edge Cases** : 3-5 cas limites critiques
- **§10 Data Model** : Entités avec champs typés, relations, contraintes, RLS
- **§13 Integrations** : Services externes (Stripe, Resend, etc.)
- **§19 Non-goals** : Ce qu'on ne construit PAS (important pour éviter le scope creep)

**Règles de génération :**
- JAMAIS inventer des features non mentionnées dans le prompt ou les réponses
- Si une info manque → utiliser un default documenté, logger en assumption
- Le brief doit scorer ≥ 70/100 (auto-évaluation)
- Écrire le fichier avec `Write` tool

### PHASE 2 : Validation avec l'utilisateur (1 minute)

Afficher un résumé compact :

```
📋 PROJECT.md généré — Score: {score}/100

┌─────────────────────────────────────────┐
│ Projet : {nom}                          │
│ Type : {type} ({secteur})               │
│ Stack : {stack}                         │
│ Features estimées : {N}                 │
│ Poids : {XS|S|M|L|XL}                  │
│ Coût estimé : ~${cost} ({profile})      │
│ Mode : {greenfield|brownfield}          │
│                                         │
│ Features probables :                    │
│  - Auth + Onboarding                    │
│  - {feature core}                       │
│  - {feature 2}                          │
│  - ...                                  │
│  - SEO + Deploy                         │
└─────────────────────────────────────────┘
```

Puis demander via AskUserQuestion :
```
Lancer les waves ?
  Y = Go (recommandé)
  edit = Ouvrir PROJECT.md pour modifier
  n = Annuler
```

### PHASE 3 : Lancement des Waves (automatique)

Si l'utilisateur dit Y :

1. **Wave 0** : Lancer l'agent `wave-0-linter` sur PROJECT.md
   ```
   Agent(subagent_type: "general-purpose", prompt: "Tu es wave-0-linter. Lis et exécute .claude/agents/wave-0-linter.md sur le PROJECT.md du répertoire courant.")
   ```

2. **Wave 1 + Design** (parallèle) : Lancer les agents `wave-1-decomposer` et `wave-design`
   ```
   Agent(prompt: "wave-1-decomposer...")
   Agent(prompt: "wave-design...", run_in_background: true)
   ```

3. **Wave 2** : Lancer l'agent `wave-2-planner`

4. **Wave 3** : Lancer l'agent `wave-3-generator`
   - Si `--parallel` : l'agent utilise spawnMultiAgent + worktrees
   - Sinon : exécution séquentielle

5. **Wave 4** : Lancer l'agent `wave-4-auditor`

Après chaque wave, afficher :
```
🌊 Wave {N} — {nom} ✓ ({durée}s, ~${cost})
```

### PHASE 4 : Résumé final

```
✅ Projet {nom} généré !

Score audit : {score}/100 ({grade})
Features : {N} implémentées
Coût total : ${total}
Temps : {duration}

Fichiers clés :
  - PROJECT.md (brief)
  - .orchestre/AUDIT_REPORT.md (audit)
  - output/prompts/ (tous les prompts)
  - CLAUDE.md (règles projet)

Prochaines étapes :
  1. npm install && npm run dev
  2. Configurer .env (voir ENV_SETUP.md)
  3. Revoir AUDIT_REPORT.md pour les fixes
```

## Rules

1. **JAMAIS** inventer des features non demandées
2. **TOUJOURS** poser les 5 questions avant de générer
3. **TOUJOURS** montrer le résumé et demander validation avant les waves
4. Si le brief score < 70, enrichir automatiquement et re-scorer
5. Si une wave échoue, afficher l'erreur et proposer de re-run
6. Respecter le profil choisi pour les modèles et l'effort
7. Maximum 15 features, même pour les projets heavy

## Resume Mode

If the user passes `--resume` or says "resume", check for existing `.orchestre/orchestre.lock`:

1. Read `orchestre.lock` and find `waves_completed` array
2. Find the last completed wave marker
3. If `checkpoints` exist for the current wave:
   - Skip features in `features_done`
   - Retry features in `features_failed` (max 1 retry)
   - Resume from first feature in `features_pending`
4. If budget is exhausted mid-wave:
   - Save checkpoint immediately
   - Use AskUserQuestion: "Budget exhausted. Options: (1) Add $X more budget, (2) Skip remaining features, (3) Abort"
   - If skip: mark remaining as `skipped` in orchestre.lock, proceed to Wave 4
5. Report status: "Resuming from Wave {N}, {X} features done, {Y} pending"

## Schema Validation

Before writing any `WAVE_X_DONE` marker, validate the wave output:
- Wave 0: `node contracts/validate.mjs BriefLint .orchestre/brief.json`
- Wave 1: `node contracts/validate.mjs IntentV2 .orchestre/intent.json`
- Wave 2: `node contracts/validate.mjs PlanV2 .orchestre/plan.json`
- Wave 3: `node contracts/validate.mjs StateV2 .orchestre/orchestre.lock`
- Wave 4: (no validation needed — audit is the validation)

If validation fails, fix the output and retry. Do NOT write `WAVE_X_DONE` until validation passes.
