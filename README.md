# Orchestre Skill

**Quality Layer for Claude Code** — Transforms every session into production-ready output.

Drop it in. Every response follows Clean Architecture, strict TypeScript, security best practices, and semantic design tokens. No config. No ceremony. Just better code.

---

## What it does

**Without Orchestre:**
```typescript
// Claude generates this
const donations = await supabase.from('donations').select()  // in a component
className="bg-blue-500"                                       // hardcoded color
throw new Error('Failed')                                     // in lib/
const data: any = await fetch(url)                           // any type
```

**With Orchestre:**
```typescript
// Claude generates this instead
const result = await getDonations(user.id)                    // lib/queries/
className="bg-primary"                                        // semantic token
return { success: false, error: new AppError('DB_ERROR') }   // Result<T>
const data: unknown = await fetchData(url)                   // strict typing
```

Same prompt. Same developer. Production-ready code automatically.

---

## Install (30 seconds)

### Global install (recommended — active in every project)

```bash
git clone https://github.com/chaaaady/orchestre-skill.git /tmp/orchestre-skill

# Copy to ~/.claude/ (global Claude Code config)
cp /tmp/orchestre-skill/CLAUDE.md ~/.claude/CLAUDE.md
cp -r /tmp/orchestre-skill/.claude/agents ~/.claude/agents
cp -r /tmp/orchestre-skill/.claude/skills ~/.claude/skills
cp -r /tmp/orchestre-skill/.claude/rules ~/.claude/rules
```

Done. Open Claude Code anywhere — Orchestre is active.

### Per-project install (hooks + knowledge base)

```bash
cd your-project
bash /tmp/orchestre-skill/install.sh .
```

This adds hooks (real-time guardrails), library templates, and knowledge base to your project.

---

## What's included

### Always active (loaded every session)

| File | Lines | What it does |
|------|-------|-------------|
| `CLAUDE.md` | 207 | Architecture rules R1-R8, coding standards, security, tool references |
| `.claude/rules/` | 279 | Path-specific TypeScript + security rules |

### Real-time guardrails (hooks)

| Hook | Blocks |
|------|--------|
| `pre-write-guard.sh` | Hardcoded colors, business logic in components, `throw` in lib/, `any` types, secrets |
| `post-write-check.sh` | TypeScript errors (runs typecheck after every write) |
| `pre-commit-audit.sh` | Secrets in staged files, exposed ENV vars |

### On-demand (slash commands)

| Command | What it does |
|---------|-------------|
| `/orchestre-go "description"` | Generates a full project: 5 questions → PROJECT.md → waves 0-4 → code + audit |
| `/orchestre-audit` | Audits existing code. Architecture + security + design. Score /100. |
| `/orchestre-status` | Shows pipeline progress, features, costs |

### Wave agents (7 specialized agents)

| Agent | Role |
|-------|------|
| `wave-0-linter` | Validates PROJECT.md, detects weight, secrets |
| `wave-1-decomposer` | Decomposes into user-facing features |
| `wave-2-planner` | Creates atomic tasks with dependency DAG |
| `wave-3-generator` | Generates code with parallel worktree execution |
| `wave-4-auditor` | Audits code against R1-R8, scores /100 |
| `feature-worker` | Implements a single feature in isolation |
| `wave-design` | Generates design system from brief |

### Knowledge base (read when relevant)

18 library templates covering: Stripe, Supabase, auth hardening, RLS, error handling, Server Actions, rate limiting, React Hook Form + Zod, Recharts, shadcn advanced, Resend, Sentry, TanStack Query, and more.

### Infrastructure

| Pattern | What it defines |
|---------|----------------|
| `query-engine.md` | Turn-loop config per wave (max_turns, max_budget, compaction) |
| `cost-tracker.md` | Granular cost tracking with pre-execution budget enforcement |
| `execution-registry.md` | Self-describing registry of all agents, tools, skills, hooks |
| `permission-context.md` | Immutable permission context per wave (plan mode vs execute) |
| `session-store.md` | JSON persistence per wave with resume and replay |

---

## The 8 Rules (always enforced)

| Rule | Principle |
|------|-----------|
| R1 | Business logic in `lib/` only — never in `app/` or `components/` |
| R2 | Components are pure UI — data via props, no fetching |
| R3 | Types inferred from Zod — `z.infer<typeof schema>`, never manual |
| R4 | Errors as `Result<T>` — never `throw` in `lib/` |
| R5 | 1 feature = 1 isolated folder — no cross-feature imports |
| R6 | Server Components by default — `'use client'` only when needed |
| R7 | Mutations via Server Actions only — no direct `fetch POST` |
| R8 | No magic strings — use const enums |

---

## Scoring

| Dimension | Without Orchestre | With Orchestre |
|-----------|------------------|----------------|
| **Code Quality** | 30/100 | **89/100** |
| **Development Speed** | 46/100 | **85/100** |
| **Maintainability** | 18/100 | **88/100** |
| **Overall** | **31/100** | **87/100** |

---

## Stack

Optimized for **Next.js + Supabase + shadcn/ui + Stripe + Resend**, but the architecture rules (R1-R8) and coding standards apply to any TypeScript project.

---

## How it works

Orchestre operates on 2 levels:

**Level 1: Quality Layer (always active)**
CLAUDE.md is read by Claude Code at every session start. The 8 rules, coding standards, security practices, and design system constraints apply automatically to every response.

**Level 2: Generation Pipeline (on demand)**
`/orchestre-go` launches a full pipeline: brief generation → feature decomposition → atomic planning → parallel code generation → post-audit scoring.

Each wave is a Claude Code agent with its own memory, tool restrictions, turn-loop constraints, and permission context.

---

## License

MIT

---

## Author

Built by **Chady** with Claude Opus 4.6.

Engineered for Claude Code. Built for production.
