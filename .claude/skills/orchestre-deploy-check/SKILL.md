# Skill: orchestre-deploy-check

## Metadata
- **Name**: orchestre-deploy-check
- **Description**: Pre-deployment verification. Catches issues that work locally but crash in production: build errors, missing ENV vars, type failures, bundle problems.
- **Trigger**: /orchestre-deploy-check, "can I deploy?", "deploy check", "pre-deploy", "ready to ship?"

## Process

### STEP 1: Build Check

Run the production build and capture errors:

```bash
npm run build 2>&1
```

If the build fails, report the errors and stop:
```
--- BUILD FAILED ---
{error output}

Fix these errors before deploying. The most common causes:
  - Type errors (strict mode in production)
  - Missing imports (tree-shaking removes unused)
  - Server/client boundary issues
---
```

If build succeeds, continue to step 2.

### STEP 2: ENV Check

Scan for all environment variables used in the codebase:

1. **Find all env references:**
   - `process.env.X` (Next.js)
   - `$env/static/private.X` and `$env/static/public.X` (SvelteKit)
   - `os.environ.get('X')` (Python)

2. **Check .env exists** with values for each

3. **Check .env.example** exists and lists all vars (without values)

4. **Verify no secrets in public vars:**
   - `NEXT_PUBLIC_` should NOT contain: SECRET, KEY (except ANON), TOKEN, PASSWORD
   - `PUBLIC_` (SvelteKit) same rules

Report:
```
--- ENV CHECK ---
Variables found in code: {N}

  ✅ {VAR} — present in .env
  ❌ {VAR} — MISSING from .env
  ⚠️ {VAR} — present but empty
  🚨 {VAR} — secret in public variable!

.env.example: {exists / MISSING}
.env in .gitignore: {yes / NO — DANGER}
---
```

### STEP 3: Type Safety Check

```bash
npx tsc --noEmit 2>&1
```

Report any type errors. These pass in dev mode but can cause runtime issues in production.

### STEP 4: Security Quick Scan

Check for common deployment security issues:

1. **Secrets in code** — grep for API key patterns (sk_live, ghp_, eyJ...)
2. **Error exposure** — check global-error.tsx / handleError doesn't leak in prod
3. **Auth on protected routes** — spot-check 2-3 protected pages have auth guards
4. **RLS / row filtering** — check if DB queries filter by user

### STEP 5: Route Health Check

List all API routes and pages, verify they're reachable:

For Next.js:
```bash
find app -name "route.ts" -o -name "page.tsx" | sort
```

For SvelteKit:
```bash
find src/routes -name "+server.ts" -o -name "+page.svelte" | sort
```

Flag any suspicious patterns:
- API routes without auth checks
- Pages without error boundaries
- Dynamic routes without param validation

### STEP 6: Bundle Analysis (if applicable)

Check for obvious bundle issues:
- Large dependencies that could be lazy-loaded
- Missing `dynamic()` / lazy imports for heavy components
- Images without optimization (`next/image`, `@sveltejs/enhanced-img`)

### FINAL REPORT

```
--- DEPLOY CHECK ---
╭──────────────────────────────────────╮
│  Build          : {PASS / FAIL}      │
│  ENV vars       : {N}/{total} OK     │
│  Type safety    : {PASS / {N} errors}│
│  Security       : {N} issues         │
│  Routes         : {N} total          │
│  Bundle         : {OK / warnings}    │
│                                      │
│  Deployable: {YES / NO / WITH RISKS} │
╰──────────────────────────────────────╯

{If NO: list blockers}
{If WITH RISKS: list warnings}
{If YES: "Ship it."}

Quick fixes needed before deploy:
  1. {fix}
  2. {fix}

Post-deploy checklist:
  - [ ] Set ENV vars in production dashboard
  - [ ] Configure webhook endpoints with production URL
  - [ ] Test auth flow in production
  - [ ] Verify Stripe webhook receives events
---
```

## Rules

1. **NEVER auto-fix** — this is a read-only check, not a fixer. Report issues, let the user fix.
2. **Build is the #1 check** — if build fails, everything else is moot
3. **Be specific** — "line 42 in app/api/route.ts" not "there might be an issue"
4. **Suggest next steps** — don't just list problems, say how to fix each one
5. **Check .env but NEVER read values** — list variable names only, never log values
6. **If everything passes** — say "Ship it." Don't over-qualify with caveats.
