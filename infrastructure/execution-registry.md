# Execution Registry — Registre auto-descriptif

> Orchestre capability registry.
> Chaque agent/tool/skill se décrit lui-même.

## Principe

Le registre contient TOUS les éléments exécutables d'Orchestre avec :
- **name** : identifiant unique
- **kind** : "agent" | "skill" | "tool" | "hook" | "knowledge"
- **responsibility** : ce que ça fait (1 ligne)
- **source** : chemin du fichier source
- **status** : "available" | "planned" | "deprecated"
- **requires** : dépendances (outils Claude Code nécessaires)

## Registre complet

### Agents

| Name | Responsibility | Source | Status | Requires |
|------|---------------|--------|--------|----------|
| wave-0-linter | Valide PROJECT.md, détecte poids, secrets, assumptions | .claude/agents/wave-0-linter.md | available | Read, Glob, Grep, AskUserQuestion, Write |
| wave-1-decomposer | Décompose en features utilisateur avec acceptance criteria | .claude/agents/wave-1-decomposer.md | available | Read, Glob, Grep, AskUserQuestion, Write, TaskCreate |
| wave-2-planner | Crée tâches atomiques, DAG, parallel groups, council checks | .claude/agents/wave-2-planner.md | available | Read, Glob, Grep, Write, TaskCreate, TaskUpdate |
| wave-3-generator | Génère code INIT + features, orchestre parallélisme | .claude/agents/wave-3-generator.md | available | ALL |
| wave-4-auditor | Audite code contre R1-R8, sécurité, design, N+1. Score /100 | .claude/agents/wave-4-auditor.md | available | Read, Glob, Grep, Bash, Write |
| feature-worker | Implémente 1 feature isolée dans un worktree | .claude/agents/feature-worker.md | available | Read, Write, Edit, Bash, Glob, Grep |
| wave-design | Génère design system complet (couleurs, typo, tokens) | .claude/agents/wave-design.md | available | Read, Glob, Grep, Bash, Write, WebFetch |

### Skills (slash commands)

| Name | Responsibility | Source | Status | Trigger |
|------|---------------|--------|--------|---------|
| orchestre-go | Génère un projet complet depuis un prompt libre | .claude/skills/orchestre-go/SKILL.md | available | /orchestre-go "description" |
| orchestre-audit | Audit code existant, score /100 | .claude/skills/orchestre-audit/SKILL.md | available | /orchestre-audit |
| orchestre-status | Affiche statut du pipeline | .claude/skills/orchestre-status/SKILL.md | available | /orchestre-status |

### Slash commands Claude Code (vérifiées disponibles)

| Name | Responsibility | Status |
|------|---------------|--------|
| /review | Review de code (nécessite gh auth) | available |
| /security-review | Audit sécurité du code | available |
| /compact | Compresser le contexte | available |
| /cost | Afficher coût de la session | available |
| /simplify | Review qualité et efficacité | available |
| /schedule | Planifier agent récurrent | available |
| /loop | Exécuter en boucle | available |

### Outils Claude Code (via ToolSearch)

| Name | Responsibility | Status |
|------|---------------|--------|
| Agent | Lancer sub-agents parallèles avec mémoire | available |
| EnterWorktree | Créer git worktree isolé | available |
| ExitWorktree | Quitter et cleanup worktree | available |
| EnterPlanMode | Forcer mode planification (deny Write/Edit) | available |
| ExitPlanMode | Quitter mode plan | available |
| AskUserQuestion | Question bloquante à l'utilisateur | available |
| WebFetch | Récupérer page web | available |
| WebSearch | Rechercher sur le web | available |
| CronCreate | Planifier tâche récurrente | available |
| CronDelete | Supprimer tâche cron | available |
| CronList | Lister tâches cron | available |
| RemoteTrigger | Déclencher agent à distance | available |
| TaskCreate | Créer une tâche | available |
| TaskUpdate | Mettre à jour une tâche | available |
| TaskList | Lister les tâches | available |
| TaskGet | Lire une tâche | available |
| TaskStop | Arrêter une tâche | available |
| TaskOutput | Lire sortie d'une tâche | available |
| SendMessage | Message à un agent actif | available |
| NotebookEdit | Éditer notebook Jupyter | available |

### Hooks

| Name | Responsibility | Source | Trigger |
|------|---------------|--------|---------|
| pre-write-guard | Bloque violations R1-R8, design tokens, secrets | hooks/pre-write-guard.sh | PreToolUse (Write/Edit) |
| post-write-check | Typecheck après écriture .ts/.tsx | hooks/post-write-check.sh | PostToolUse (Write/Edit) |
| pre-commit-audit | Scan secrets avant commit | hooks/pre-commit-audit.sh | PreCommit |

### Knowledge (fichiers de référence)

| Name | Responsibility | Source |
|------|---------------|--------|
| stripe-billing | Patterns Stripe (checkout, webhooks, billing portal) | fixed-assets/library-templates/stripe-billing.md |
| supabase-patterns | Patterns Supabase (clients, cache, relationships) | fixed-assets/library-templates/supabase-patterns.md |
| auth-hardening | Auth SSR, PKCE, middleware, getUser() | fixed-assets/library-templates/auth-hardening.md |
| error-handling | AppError, Result<T>, error boundaries | fixed-assets/library-templates/error-handling.md |
| rls-patterns | 10 patterns RLS réutilisables | fixed-assets/library-templates/rls-patterns.md |
| frontend-patterns | Server/Client Components, Suspense | fixed-assets/library-templates/frontend-patterns.md |
| design-quality | 10 anti-patterns, checklist 10 points | knowledge-base/design-quality.md |

## Lookup

Le CLAUDE.md référence ce registre. Quand Claude Code reçoit une demande :
1. Tokenize la demande
2. Score chaque entrée du registre (name + responsibility)
3. Sélectionne le meilleur match
4. Vérifie le status = "available"
5. Vérifie les requires (outils nécessaires disponibles)
6. Exécute

Ce n'est pas un routing LLM coûteux — c'est un match par tokens, léger et rapide.
