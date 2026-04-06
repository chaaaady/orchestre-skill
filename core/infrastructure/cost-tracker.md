# CostTracker — Suivi de coûts granulaire

> Orchestre cost management protocol.
> Chaque opération est labellisée et coûtée.

## Principe

Le CostTracker enregistre chaque opération avec :
- **label** : identifiant de l'opération (ex: "wave-1-decompose-F03")
- **tokens_in** : tokens d'entrée consommés
- **tokens_out** : tokens de sortie générés
- **cost_usd** : coût estimé en dollars
- **timestamp** : horodatage

## Structure

```json
{
  "project_id": "mon-projet",
  "profile": "balanced",
  "events": [
    {
      "label": "wave-0-lint",
      "wave": 0,
      "tokens_in": 2500,
      "tokens_out": 1200,
      "cost_usd": 0.04,
      "model": "claude-sonnet-4-6",
      "timestamp": "2026-04-01T10:00:00Z",
      "stop_reason": "completed"
    },
    {
      "label": "wave-1-decompose",
      "wave": 1,
      "tokens_in": 15000,
      "tokens_out": 8000,
      "cost_usd": 0.92,
      "model": "claude-opus-4-6",
      "timestamp": "2026-04-01T10:05:00Z",
      "stop_reason": "completed"
    }
  ],
  "totals": {
    "tokens_in": 17500,
    "tokens_out": 9200,
    "cost_usd": 0.96,
    "events_count": 2
  },
  "budget": {
    "max_usd": 10.00,
    "remaining_usd": 9.04,
    "alert_threshold": 0.75
  }
}
```

## Budget Enforcement

### Pré-exécution (AVANT chaque wave)
1. Lire `.orchestre/cost-tracker.json`
2. Calculer `remaining = budget.max_usd - totals.cost_usd`
3. Estimer le coût de la wave à venir (depuis le profil)
4. Si `estimated > remaining` → AskUserQuestion :
   ```
   "Budget restant : $X. Wave suivante estimée à $Y.
    Continuer ? (Y/n/increase budget)"
   ```

### Post-exécution (APRÈS chaque wave)
1. Après chaque wave, exécuter `/cost` pour le coût réel
2. Enregistrer l'event dans cost-tracker.json
3. Mettre à jour les totaux
4. Si `totals.cost_usd > budget.max_usd * alert_threshold` → warning

### Estimation par modèle

| Modèle | Input ($/1M tokens) | Output ($/1M tokens) |
|--------|---------------------|---------------------|
| claude-opus-4-6 | $15.00 | $75.00 |
| claude-sonnet-4-6 | $3.00 | $15.00 |
| claude-haiku-4-5 | $0.80 | $4.00 |

## Utilisation

L'agent wave-3-generator doit :
1. Au début : lire cost-tracker.json, vérifier le budget
2. Après chaque feature : enregistrer un event
3. Si budget alert → demander à l'user
4. À la fin : `/cost` pour le coût réel, mettre à jour

Le `/orchestre-status` affiche les coûts accumulés depuis cost-tracker.json.

## Fichier de sortie

`.orchestre/cost-tracker.json` — mis à jour après chaque wave.
