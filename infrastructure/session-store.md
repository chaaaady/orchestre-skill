# Session Store — Persistence & Replay

> Orchestre session persistence protocol.
> 1 fichier JSON par session. Resume natif. Replay pour debug.

## Principe

Chaque wave Orchestre produit une **session persistée** :
- 1 fichier JSON par wave dans `.orchestre/sessions/`
- Contient : messages, tokens, coûts, résultats, stop_reason
- Permet le **resume** (reprendre exactement où on s'est arrêté)
- Permet le **replay** (rejouer pour debug ou audit)

## Structure d'une session

```json
{
  "session_id": "wave-1-2026-04-01T10-05-00",
  "wave": 1,
  "agent": "wave-1-decomposer",
  "model": "claude-opus-4-6",
  "effort": "max",
  "started_at": "2026-04-01T10:05:00Z",
  "completed_at": "2026-04-01T10:12:30Z",
  "duration_seconds": 450,
  "status": "completed",
  "turns": [
    {
      "turn_number": 1,
      "prompt": "Read PROJECT.md and decompose into features...",
      "output": "I've identified 8 features...",
      "tools_used": ["Read", "Glob"],
      "permission_denials": [],
      "tokens_in": 5000,
      "tokens_out": 3000,
      "cost_usd": 0.32
    },
    {
      "turn_number": 2,
      "prompt": "Create the intent JSON...",
      "output": "orchestre.intent.json written with 8 features...",
      "tools_used": ["Write", "TaskCreate"],
      "permission_denials": ["Edit"],
      "tokens_in": 8000,
      "tokens_out": 5000,
      "cost_usd": 0.60
    }
  ],
  "totals": {
    "turns": 2,
    "tokens_in": 13000,
    "tokens_out": 8000,
    "cost_usd": 0.92,
    "tools_used": ["Read", "Glob", "Write", "TaskCreate"],
    "permission_denials": ["Edit"]
  },
  "outputs": {
    "files_written": [
      ".orchestre/orchestre.intent.json",
      ".orchestre/wave-1-intent.json",
      ".orchestre/WAVE_1_DONE"
    ],
    "memory_keys_set": [
      "features_count",
      "parallel_groups",
      "design_system",
      "copy_deck"
    ]
  },
  "stop_reason": "completed",
  "error": null
}
```

## Fichiers de session

```
.orchestre/sessions/
  wave-0-2026-04-01T10-00-00.json
  wave-1-2026-04-01T10-05-00.json
  wave-design-2026-04-01T10-05-00.json
  wave-2-2026-04-01T10-12-30.json
  wave-3-2026-04-01T10-20-00.json
  wave-3-feature-F01-2026-04-01T10-22-00.json
  wave-3-feature-F02-2026-04-01T10-22-00.json
  wave-3-feature-F03-2026-04-01T10-22-00.json
  wave-4-2026-04-01T10-45-00.json
```

## Resume

Si une wave est interrompue :
1. Le fichier session a `status: "interrupted"` et `stop_reason: "error"` ou `"max_budget_reached"`
2. Pour reprendre : lire le dernier tour, restaurer le contexte
3. L'agent peut voir les tours précédents et continuer

```
Pour reprendre :
1. Trouver la dernière session incomplète dans .orchestre/sessions/
2. Lire les turns existants
3. Relancer l'agent avec le contexte restauré
4. L'agent continue depuis le dernier tour
```

## Replay

Pour debugger :
1. Lire le fichier session JSON
2. Afficher chaque tour : prompt → output → tools → cost
3. Identifier où ça a échoué
4. Comprendre pourquoi (permission denials, budget, erreur)

## Transcript Compaction

Quand les tours s'accumulent :
1. Si `turns.length > compact_after` (de QueryEngine config)
2. Compresser les anciens tours (garder les N derniers)
3. Les tours compressés sont résumés en 1 ligne
4. Le contexte reste gérable

## Intégration

### Avec le CostTracker
Chaque session met à jour `cost-tracker.json` avec ses totaux.

### Avec le PermissionContext
Les permission_denials de chaque tour sont persistés.

### Avec orchestre.lock
L'orchestre.lock référence les session_ids pour chaque wave.

### Avec /orchestre-status
Le skill lit les sessions pour afficher le statut.
