# QueryEngine — Turn Loop Protocol

> Inspired by production AI harness engineering patterns.
> Chaque wave Orchestre est un turn-loop avec contraintes dures.

## Principe

Un **turn-loop** est une boucle d'exécution bornée :
- Chaque "tour" = 1 prompt → 1 routing → 1 exécution → 1 résultat
- La boucle s'arrête quand : `max_turns` atteint OU `max_budget_tokens` atteint
- Chaque tour produit un `TurnResult` avec output, usage, et stop_reason

## Configuration par Wave

| Wave | max_turns | max_budget_tokens | compact_after | Effort |
|------|-----------|-------------------|---------------|--------|
| 0 — Lint | 3 | 15 000 | 5 | normal |
| 1 — Decomposition | 8 | 80 000 | 10 | max |
| Design | 5 | 30 000 | 8 | normal |
| 2 — Planning | 8 | 80 000 | 10 | max |
| 3 — Generation (per feature) | 12 | 50 000 | 15 | normal |
| 3 — Generation (INIT) | 15 | 100 000 | 18 | max |
| 4 — Audit | 10 | 60 000 | 12 | normal |

## TurnResult

Chaque tour produit :
```
TurnResult:
  turn_number: int           # Numéro du tour (1-based)
  prompt: string             # Ce qui a été envoyé
  output: string             # Ce qui a été reçu
  matched_tools: string[]    # Outils utilisés dans ce tour
  permission_denials: string[] # Outils refusés
  usage:
    input_tokens: int
    output_tokens: int
  stop_reason: "completed" | "max_turns_reached" | "max_budget_reached" | "error"
  cost_usd: float            # Coût estimé de ce tour
```

## Stop Reasons

| Reason | Action |
|--------|--------|
| `completed` | Tour terminé normalement. Continuer ou arrêter selon le contexte. |
| `max_turns_reached` | Limite de tours atteinte. Persister l'état et arrêter. |
| `max_budget_reached` | Budget tokens épuisé. Alerter l'utilisateur via AskUserQuestion. |
| `error` | Erreur d'exécution. Logger et proposer retry ou skip. |

## Compaction

Quand `turn_number > compact_after` :
- Utiliser `/compact` pour compresser le contexte
- Garder les N derniers messages (sliding window)
- Persister les messages compressés dans la session

## Intégration avec les Waves

Chaque wave-agent doit :
1. Lire sa config turn-loop (max_turns, max_budget_tokens)
2. À chaque tour, vérifier les contraintes
3. Si `max_budget_reached` → AskUserQuestion "Budget atteint. Continuer ?"
4. Si `max_turns_reached` → Persister et arrêter proprement
5. Après chaque tour, mettre à jour le CostTracker
6. À la fin, persister la session (SessionStore)

## Comment utiliser dans le CLAUDE.md

Les agents lisent ce fichier pour connaître leurs limites :
```
"Tu es wave-1-decomposer. Tes contraintes :
 - Maximum 8 tours de conversation
 - Budget maximum 80 000 tokens
 - Si tu dépasses, arrête-toi proprement et persiste ton état"
```
