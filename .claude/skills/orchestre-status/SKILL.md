# Skill: orchestre-status

## Metadata
- **Name**: orchestre-status
- **Description**: Affiche le statut du projet Orchestre (waves, features, coûts, score).
- **Trigger**: /orchestre-status, "status orchestre", "où en est le projet"

## Process

1. Vérifier si `.orchestre/` existe dans le répertoire courant
2. Si non : "Pas de projet Orchestre détecté. Utilise /orchestre-go pour en créer un."
3. Si oui, lire les fichiers disponibles et afficher :

```
📊 Orchestre Status

Projet : {nom} ({project_id})
Poids  : {weight} | Profile : {profile}

Waves :
  Wave 0 (Lint)          : ✅ Done (score: 13/13)
  Wave 1 (Decomposition) : ✅ Done (score: 89/100, 8 features)
  Wave 2 (Planning)      : ✅ Done (9 tasks, 2 parallel groups)
  Wave 3 (Generation)    : ⏳ In progress (F05/F08)
  Wave 4 (Audit)         : ⬜ Pending

Features :
  F01 Auth           : ✅ Done
  F02 Dashboard      : ✅ Done
  F03 Projets        : ✅ Done
  F04 Tâches         : ✅ Done
  F05 Board Kanban   : ⏳ In progress
  F06 Rapports       : ⬜ Pending
  F07 Paramètres     : ⬜ Pending
  F08 SEO            : ⬜ Pending

Coûts :
  Estimé  : $4.50
  Actuel  : $2.80 (Wave 0-3 partiel)

Prochaine action : Terminer Wave 3 (F05-F08)
```

## Rules
- Lire les fichiers .orchestre/*.json pour les données
- Si un fichier est absent, marquer la wave comme "Pending"
- Afficher les coûts réels si disponibles dans orchestre.lock
