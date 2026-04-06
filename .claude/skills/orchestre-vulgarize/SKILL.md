# Skill: orchestre-vulgarize

## Metadata
- **Name**: orchestre-vulgarize
- **Description**: Explains what code does in plain language. One file, one feature, or the entire project. Scores explanation pertinence.
- **Trigger**: /orchestre-vulgarize, "explain this code", "what does this do", "vulgarize", "explain the flow"

## Parameters
- `target` (optional): file path, feature name, or `--all` for entire project
- `--level` (optional): junior (default) | tech | founder
  - **junior**: Zero jargon. "This file handles login. When someone types their email and password, it checks if they exist in the database."
  - **tech**: Technical but clear. "Server Action that validates input with Zod, queries Supabase with RLS, returns Result<T>."
  - **founder**: Business-focused. "This is the payment flow. Users pick a plan → Stripe charges them → webhook confirms → access granted."
- `--lang` (optional): en (default) | fr

## Process

### MODE 1: Single target (`/orchestre-vulgarize app/dashboard/page.tsx`)

**Step 1: Read the file**

Read the target file completely.

**Step 2: Identify what it does**

Determine:
- What is this file's **role** in the project? (page, component, query, mutation, webhook, config, schema)
- What **data** does it handle? (users, invoices, payments, etc.)
- What **actions** can the user take? (view, create, edit, delete, pay)
- What **other files** does it depend on? (imports)
- What **would break** if this file disappeared?

**Step 3: Explain**

```
--- VULGARIZE: {filename} ---

What it is: {role in 1 sentence}

What it does:
  1. {step 1 — what happens first}
  2. {step 2 — what happens next}
  3. {step 3 — what's the result}

Data flow:
  {where data comes from} → {what this file does with it} → {where it goes}

Depends on:
  - {file} — {why}
  - {file} — {why}

If this breaks: {what the user would see}

Pertinence: {score}/10 — {why this file matters}
---
```

### MODE 2: Feature (`/orchestre-vulgarize "payments"`)

**Step 1: Find all files related to the feature**

Grep and glob for files related to the feature name. Look in:
- `lib/queries/`, `lib/mutations/`, `src/lib/server/` (business logic)
- `components/`, `src/lib/components/` (UI)
- `app/`, `src/routes/` (pages/routes)
- `actions/` (mutations)
- `lib/schemas/` (types)

**Step 2: Map the flow**

Build the user flow step by step:

```
--- VULGARIZE: {feature name} ---

What it is: {feature in 1 sentence}

User flow:
  1. User goes to {page}
  2. They see {what's displayed}
  3. They click {action}
  4. Behind the scenes: {what happens technically}
  5. Result: {what the user sees after}

Files involved ({N}):
  ┌─────────────────────────────────────────────┐
  │ {page/route file}          ← entry point    │
  │   → {component}            ← UI             │
  │   → {action/form action}   ← mutation       │
  │     → {lib/mutation}       ← business logic │
  │       → {schema}           ← validation     │
  │       → {db/api call}      ← data           │
  └─────────────────────────────────────────────┘

Security:
  - Auth: {how it's protected}
  - Validation: {what's validated}
  - Edge cases: {what happens if it fails}

Pertinence: {score}/10 — {why this feature matters to the user}
---
```

### MODE 3: Entire project (`/orchestre-vulgarize --all`)

**Step 1: Scan the project**

Read:
- `package.json` (project name, deps)
- All page/route files (detect features)
- `lib/` or `src/lib/server/` structure
- Auth setup (middleware, hooks.server.ts)
- Payment setup (Stripe, webhook)

**Step 2: Build the project map**

```
--- VULGARIZE: {project name} ---

What this project is:
  {1-2 sentences describing what the app does, for whom}

Tech stack:
  {framework} + {database} + {auth} + {payments} + {styling}

Features ({N}):
  1. {feature name} — {what it does in 1 line}
  2. {feature name} — {what it does in 1 line}
  ...

Architecture:
  {folder}     → {what's inside — 1 line}
  {folder}     → {what's inside — 1 line}
  ...

Main user flows:

  Flow 1: {name}
  {step by step, 3-5 steps}

  Flow 2: {name}
  {step by step, 3-5 steps}

Data model:
  {entity} → has many {entity} → belongs to {entity}
  {entity} → has one {entity}

Security model:
  - Auth: {how users authenticate}
  - Authorization: {who can see what}
  - Payments: {how money flows}

What's strong:
  ✅ {concrete strength}
  ✅ {concrete strength}

What's missing:
  ⚠️ {concrete gap}
  ⚠️ {concrete gap}

Pertinence score:
  Code quality:    {n}/10
  Completeness:    {n}/10
  Security:        {n}/10
  Maintainability: {n}/10
  Overall:         {n}/10
---
```

## Pertinence Scoring

The pertinence score measures how **important and well-implemented** the target is:

| Score | Meaning |
|-------|---------|
| 9-10 | Critical and well-built. Core to the product. |
| 7-8 | Important and solid. Some edge cases could be better. |
| 5-6 | Works but has gaps. Not fully production-ready. |
| 3-4 | Exists but has significant issues. Needs attention. |
| 1-2 | Broken or irrelevant. Should be reworked or removed. |

Factors:
- **Does it serve the user?** (a payment flow scores higher than a settings page)
- **Is it complete?** (happy path only = lower, edge cases handled = higher)
- **Is it secure?** (auth check missing = lower)
- **Is it maintainable?** (1000-line monolith = lower, clean separation = higher)

## Rules

1. **Explain like the target audience** — junior gets zero jargon, tech gets precise terms, founder gets business impact
2. **ALWAYS show the data flow** — where data comes from, what happens, where it goes
3. **ALWAYS score pertinence** — every explanation ends with a score
4. **Be honest** — if the code is bad, say it. If it's good, say it.
5. **Link files to each other** — show how they connect, not just what each one does
6. **Short sentences** — if an explanation needs >3 sentences, it's too complex. Split it.
7. **Never suggest changes** — this is a reading tool, not a refactoring tool. Explain, don't fix.
