# Permission Context — Contrôle d'accès par wave

> Orchestre access control protocol.
> Permissions = dataclass immutable, deny par nom/préfixe, case-insensitive.

## Principe

Chaque wave a un **PermissionContext** qui définit quels outils sont autorisés et lesquels sont bloqués. Le contexte est :
- **Immutable** — créé au début de la wave, jamais modifié
- **Stateless** — pas d'état mutable, juste des règles
- **Auditable** — chaque denial est enregistré avec la raison

## Permission Context par Wave

### Wave 0 — Lint (mode plan strict)
```json
{
  "wave": 0,
  "mode": "plan",
  "allow": ["Read", "Glob", "Grep", "AskUserQuestion"],
  "deny_names": ["Write", "Edit", "Bash", "Agent"],
  "deny_prefixes": ["mcp_"],
  "deny_reason": "Wave 0 is read-only: validation only, no file modifications"
}
```

### Wave 1 — Decomposition (mode plan + tasks)
```json
{
  "wave": 1,
  "mode": "plan",
  "allow": ["Read", "Glob", "Grep", "AskUserQuestion", "Write", "TaskCreate", "TaskUpdate"],
  "deny_names": ["Edit", "Bash", "Agent"],
  "deny_prefixes": [],
  "deny_reason": "Wave 1 can write to .orchestre/ only, no code editing",
  "write_restrict": ".orchestre/*"
}
```

### Wave 2 — Planning (mode plan + tasks)
```json
{
  "wave": 2,
  "mode": "plan",
  "allow": ["Read", "Glob", "Grep", "Write", "TaskCreate", "TaskUpdate", "TaskList"],
  "deny_names": ["Edit", "Bash", "Agent"],
  "deny_prefixes": [],
  "deny_reason": "Wave 2 plans but doesn't code",
  "write_restrict": ".orchestre/*"
}
```

### Wave 3 — Generation (mode execute, full access)
```json
{
  "wave": 3,
  "mode": "execute",
  "allow": ["*"],
  "deny_names": [],
  "deny_prefixes": [],
  "deny_reason": null
}
```

### Wave 4 — Audit (mode read-only)
```json
{
  "wave": 4,
  "mode": "readonly",
  "allow": ["Read", "Glob", "Grep", "Bash", "Write"],
  "deny_names": ["Edit", "Agent"],
  "deny_prefixes": [],
  "deny_reason": "Wave 4 audits but doesn't modify project code",
  "write_restrict": ".orchestre/*"
}
```

## Enforcement

### Via EnterPlanMode (Waves 0, 1, 2)
Les waves de planification utilisent `EnterPlanMode` pour bloquer Write/Edit au niveau système :
```
1. Au début de la wave → EnterPlanMode
2. Exécuter la wave (Read, Glob, Grep, AskUserQuestion)
3. Écrire les outputs dans .orchestre/ (Write autorisé pour ce path)
4. À la fin → ExitPlanMode
```

### Via hooks (Wave 3)
Le pre-write-guard.sh valide le contenu AVANT écriture — même en mode execute.

### Via deny dans l'agent definition (toutes les waves)
Chaque agent .md liste ses outils autorisés et interdits dans la section TOOLS.

## Permission Denials

Chaque denial est enregistré :
```json
{
  "tool_name": "Edit",
  "wave": 0,
  "reason": "Wave 0 is read-only: validation only, no file modifications",
  "timestamp": "2026-04-01T10:00:05Z"
}
```

Les denials sont stockés dans `.orchestre/permission-denials.json` pour audit.

## Intégration CLAUDE.md

Le CLAUDE.md dit :
```
"Wave 0-2 = mode plan. Utilise EnterPlanMode au début.
 Wave 3 = mode execute. Full access mais hooks actifs.
 Wave 4 = mode readonly. Audit seulement, pas de modifications."
```

Les agents lisent leur PermissionContext et s'y conforment.
