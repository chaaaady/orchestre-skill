# Skill: orchestre-audit

## Metadata
- **Name**: orchestre-audit
- **Description**: Audit architecture, sécurité, design et performance du code actuel. Score /100.
- **Trigger**: /orchestre-audit, "audit le code", "vérifie l'architecture", "score le projet"

## Parameters
- `--scope` (optional): all (default) | architecture | security | design | performance
- `--fix` (optional): Tente de corriger automatiquement les violations trouvées

## Process

1. Lancer l'agent `wave-4-auditor` :
   ```
   Agent(prompt: "Tu es wave-4-auditor. Lis et exécute .claude/agents/wave-4-auditor.md sur le code du répertoire courant. Audite TOUT le code, pas seulement le code généré par Orchestre.")
   ```

2. L'agent vérifie :
   - **Architecture R1-R8** (/28 pts) : business logic placement, component purity, Zod types, Result<T>, feature isolation, Server Components, Server Actions, magic strings
   - **Fichiers obligatoires** (/7 pts) : proxy.ts, not-found, loading, global-error, README, AGENTS.md, lib/config.ts
   - **Singletons** (/15 pts) : Supabase, Stripe, Resend, AI clients
   - **N+1 queries** (/15 pts) : .map() + DB call detection
   - **Design & qualité** (/20 pts) : hardcoded colors, design checklist
   - **Sécurité** (/15 pts) : global-error exposure, console.log, ENV, webhooks, auth

3. Afficher le rapport :
   ```
   🔍 Audit Orchestre — Score: {score}/100 ({grade})

   Architecture : {n}/28
   Fichiers     : {n}/7
   Singletons   : {n}/15
   N+1          : {n}/15
   Design       : {n}/20
   Sécurité     : {n}/15

   Issues critiques : {count}
   Top 3 fixes : ...
   ```

4. Si `--fix` : tenter de corriger les violations automatiquement (déplacer business logic vers lib/, remplacer throw par Result, etc.)

## Rules
- L'audit est READ-ONLY sauf si --fix est spécifié
- Toujours fournir des fichiers et numéros de ligne pour chaque issue
- Toujours proposer un fix actionable pour chaque issue
