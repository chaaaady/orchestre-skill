<p align="center">
  <img src="https://raw.githubusercontent.com/chaaaady/orchestre/main/.github/assets/orchestre-logo.png" alt="Orchestre" width="120" />
</p>

<h1 align="center">Orchestre</h1>

<p align="center">
  <strong>Clean architecture enforcement for AI-generated code.</strong><br>
  <sub>Hooks, rules, and agents that turn Claude Code and Cursor into production-grade machines.</sub>
</p>

<p align="center">
  <a href="https://github.com/chaaaady/orchestre/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/tests-166_passing-brightgreen" alt="166 tests passing" />
  <img src="https://img.shields.io/badge/hooks-17_checks-orange" alt="17 hook checks" />
  <img src="https://img.shields.io/badge/stacks-2-blueviolet" alt="2 stacks" />
</p>

<p align="center">
  <a href="#the-problem">Problem</a>&ensp;&bull;&ensp;<a href="#how-it-works">How It Works</a>&ensp;&bull;&ensp;<a href="#quickstart">Quickstart</a>&ensp;&bull;&ensp;<a href="#the-8-rules">Rules</a>&ensp;&bull;&ensp;<a href="#supported-stacks">Stacks</a>&ensp;&bull;&ensp;<a href="CONTRIBUTING.md">Contribute</a>
</p>

---

## The Problem

AI code generators produce working prototypes on day 1.
By day 2, adding a feature breaks everything.

The code compiles — but it's a monolith with `any` types, hardcoded colors, DB calls in components, unhandled errors, and no separation of concerns. You're not building software. You're accumulating technical debt at the speed of an LLM.

**Orchestre fixes this at the source.** Instead of auditing after the fact, it intercepts every file write with AST-based hooks and enforces clean architecture in real time — before the code reaches disk.

---

## Before / After

```typescript
// WITHOUT ORCHESTRE — what Claude actually generates

const donations = await supabase.from('donations').select()  // DB call in component
className="bg-blue-500 text-red-600"                          // hardcoded colors
throw new Error('Failed')                                      // unhandled throw in lib/
const data: any = await fetch(url)                            // any type, fetch in UI
```

```typescript
// WITH ORCHESTRE — same prompt, same model

const result = await getDonations(user.id)                    // lib/queries/, Result<T>
className="bg-primary text-destructive"                        // semantic tokens
return { success: false, error: new AppError('DB_ERROR') }    // explicit error handling
const parsed = userSchema.safeParse(await fetchUser(id))      // Zod-validated, typed
```

No config. No ceremony. The hooks block the first version automatically.

---

## How It Works

Orchestre operates at two levels:

### Level 1 — Quality Layer (always active)

Loaded into every Claude Code or Cursor session. Zero config.

**Pre-write hooks** analyze every file before it's saved — using the TypeScript compiler API, not regex. They block violations in real time:

| Check | ID | Catches |
|-------|----|---------|
| Secret detection | SECRET-01..10 | Stripe keys, JWTs, GitHub PATs, AWS credentials |
| Type safety | TS-01 | `any` type annotations |
| Error discipline | TS-02 | `throw` in business logic layer |
| Architecture boundary | TS-03 | DB/fetch calls in components |
| Import hygiene | IMPORT-01..03 | Deep relative paths, cross-feature imports, server leaks |
| Design tokens | DESIGN-01 | Hardcoded Tailwind colors (`bg-blue-500`) |

Plus **10 runtime guards**: over-engineering detection, breakage alerts, complexity warnings, dead code tracking, honest evaluation mode, ENV diagnostics, and progress awareness.

### Level 2 — Generation Pipeline (on demand)

Launch with `/orchestre-go "build a SaaS for X"` to get a full pipeline:

```
 You describe it
      │
      ▼
 ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
 │ Wave 0   │───▶│ Wave 1   │───▶│ Wave 2   │───▶│ Wave 3   │───▶│ Wave 4   │
 │ Lint     │    │ Features │    │ Task DAG │    │ Code Gen │    │ Audit    │
 │ brief    │    │ decomp   │    │ planning │    │ parallel │    │ score    │
 └─────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
   read-only      read-only       read-only       execute        read-only
```

Each wave is a **separate Claude Code agent** with its own memory, tool restrictions, and token budget. No prompt debt. No infinite loops. Features without mutual dependencies execute in parallel via git worktrees.

---

## Quickstart

```bash
# Interactive — picks your stack
npx orchestre init

# Direct
npx orchestre init --stack nextjs-supabase
npx orchestre init --stack sveltekit-drizzle
```

Or clone + install:

```bash
git clone https://github.com/chaaaady/orchestre.git /tmp/orchestre
node /tmp/orchestre/bin/install.mjs ./my-project --stack nextjs-supabase
```

Verify the installation:

```bash
node bin/verify.mjs
```

That's it. Every Claude Code session in this project now enforces clean architecture.

---

## The 8 Rules

Six rules are **universal** (every stack, every language). Two are **stack-specific**.

| Rule | Enforces | Prevents |
|------|----------|----------|
| **R1** | Business logic in `lib/` only | DB calls in components |
| **R2** | Components = pure UI (props only) | `useQuery`, `fetch` in UI |
| **R3** | Types from schemas (`z.infer<>`) | Manual type duplication |
| **R4** | Errors as values (`Result<T>`) | Unhandled `throw` in logic layer |
| **R5** | 1 feature = 1 isolated folder | Cross-feature imports |
| **R6** | Server-first rendering | Client-side everything |
| **R7** | Mutations via Server/Form Actions | Raw `fetch POST` to API routes |
| **R8** | Typed constants | Magic strings |

R1-R5 and R8 are enforced by AST hooks. R6-R7 adapt to your stack's conventions.

---

## Supported Stacks

| Stack | ID | Hooks | Knowledge files |
|-------|-----|-------|-----------------|
| **Next.js** + Supabase + Tailwind + Stripe | `nextjs-supabase` | 3 AST checkers | 15 pattern guides |
| **SvelteKit** + Drizzle + Tailwind + Stripe | `sveltekit-drizzle` | 1 AST checker + server leak detection | 11 pattern guides |

Each stack ships with production patterns for auth, payments, forms, webhooks, RLS, rate limiting, error handling, and more. These aren't snippets — they're full lifecycle patterns covering edge cases, error states, and security.

### Adding a stack

```
stacks/your-stack/
├── stack.json              # Config and rule mappings
├── CLAUDE.stack.md         # Stack-specific rules
├── hooks/                  # AST-based checkers
├── knowledge/              # Production patterns
└── templates/              # Starter code
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

---

## What's Inside

```
orchestre/
├── core/
│   ├── hooks/              # Pre-write guard + secret detection
│   ├── agents/             # 7 wave agents for the generation pipeline
│   ├── contracts/          # JSON Schema validation for pipeline artifacts
│   ├── infrastructure/     # Turn-loop, cost tracking, sessions, permissions
│   ├── knowledge/          # Universal patterns (errors, Zod, design)
│   └── profiles/           # Budget / Balanced / Premium cost configs
├── stacks/
│   ├── nextjs-supabase/    # Hooks, rules, knowledge, templates
│   └── sveltekit-drizzle/  # Hooks, rules, knowledge, templates
├── examples/
│   ├── saas-nextjs/        # Complete invoicing SaaS (17 files, all R1-R8)
│   └── saas-sveltekit/     # Same app, different stack (16 files)
├── bin/
│   ├── install.mjs         # Smart installer with manifest tracking
│   ├── verify.mjs          # 20-check installation validator
│   └── cli.mjs             # CLI entry point
└── __tests__/              # 166 tests
```

---

## Claude Code Commands

When installed in a Claude Code project, Orchestre adds these slash commands:

| Command | What it does |
|---------|-------------|
| `/orchestre-go "description"` | Full pipeline: brief → 5 waves → production code + audit |
| `/orchestre-extend "feature"` | Add a feature respecting existing architecture |
| `/orchestre-harden` | Add error handling, edge cases, security hardening |
| `/orchestre-deploy-check` | Pre-deploy: build, ENV vars, types, security, routes |
| `/orchestre-recover` | Restructure chaotic vibe-coded project into clean arch |
| `/orchestre-audit` | Audit existing code and score /100 |

---

## Architecture

Orchestre is not a linter. It's not a CLI that runs after you write code. It's an **interception layer** that sits between the AI and the filesystem.

```
  Claude / Cursor
        │
        │ Write("components/chart.tsx", content)
        ▼
  ┌─────────────────────┐
  │  orchestre-guard.mjs │ ← Pre-write hook
  │                     │
  │  1. Parse AST        │
  │  2. Run 17 checks    │
  │  3. Block or pass    │
  └─────────────────────┘
        │
        ▼
   File written (or blocked with violation details)
```

The guard loads **core checkers** (secrets, always active) and **stack checkers** (AST-based, loaded dynamically from your stack's `hooks/` directory). Checkers run in parallel with a 3-second timeout. If a checker crashes, the hook degrades gracefully — it warns instead of blocking.

The contract system validates pipeline artifacts (intent, plan, state) against JSON Schemas before each wave transition. No wave can start until the previous one's output passes validation.

---

## Philosophy

- **Guard, don't audit.** Block violations before they reach disk. Don't review after the fact.
- **Architecture before code.** Decisions happen in Wave 2. Code happens in Wave 3. Never mixed.
- **Ship 7/10, don't polish 10/10.** The over-engineering guard detects scope drift and diminishing returns.
- **Fail loud.** Errors surface immediately. Silent degradation is a bug.
- **Parallel-first.** Independent features build simultaneously in git worktrees.

---

## Examples

The `examples/` directory contains complete generated projects that follow all 8 rules:

| Example | Stack | Demonstrates |
|---------|-------|-------------|
| [`saas-nextjs/`](examples/saas-nextjs/) | Next.js + Supabase + Stripe | Auth, CRUD, Stripe webhooks, Result pattern, RLS |
| [`saas-sveltekit/`](examples/saas-sveltekit/) | SvelteKit + Drizzle + Stripe | Same app, different stack — proves portability |

---

## Contributing

The most impactful contribution is **adding a new stack**. See [CONTRIBUTING.md](CONTRIBUTING.md).

Other ways to contribute: improve knowledge templates with real-world patterns, add hook checkers for new frameworks, or report false positives.

---

## License

[MIT](LICENSE)

---

<p align="center">
  Built by <a href="https://github.com/chaaaady"><strong>Chady</strong></a>
</p>
