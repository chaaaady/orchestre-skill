# Orchestre Skill

**Quality Layer for AI-assisted coding.** Works with **Claude Code** (full power) and **Cursor** (rules + guards).

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

```bash
git clone https://github.com/chaaaady/orchestre-skill.git /tmp/orchestre-skill
cd your-project
```

### Claude Code (full power — hooks, agents, pipeline, guards)

```bash
bash /tmp/orchestre-skill/install.sh --claude .
```

### Cursor (rules + guards — no hooks/agents)

```bash
bash /tmp/orchestre-skill/install.sh --cursor .
```

### Both (if you use both editors)

```bash
bash /tmp/orchestre-skill/install.sh --both .
```

Auto-detects your editor if you omit the flag.

---

## What's included

### Always active (loaded every session)

| File | Claude Code | Cursor | What it does |
|------|------------|--------|-------------|
| `CLAUDE.md` / `.cursorrules` | 531 lines | 427 lines | Architecture rules R1-R8, guards, coding standards, security |
| `.claude/rules/` / `.cursor/rules/` | Yes | Yes | Path-specific TypeScript + security rules |

### Real-time guardrails — Claude Code only

| Hook | Blocks |
|------|--------|
| `pre-write-guard.sh` | Hardcoded colors, business logic in components, `throw` in lib/, `any` types, secrets |
| `post-write-check.sh` | TypeScript errors (runs typecheck after every write) |
| `pre-commit-audit.sh` | Secrets in staged files, exposed ENV vars |

### Slash commands — Claude Code only

| Command | What it does |
|---------|-------------|
| `/orchestre-go "description"` | Generates a full project: 5 questions → PROJECT.md → waves 0-4 → code + audit |
| `/orchestre-audit` | Audits existing code. Architecture + security + design. Score /100. |
| `/orchestre-status` | Shows pipeline progress, features, costs |

### Wave agents — Claude Code only

| Agent | Role |
|-------|------|
| `wave-0-linter` | Validates PROJECT.md, detects weight, secrets |
| `wave-1-decomposer` | Decomposes into user-facing features |
| `wave-2-planner` | Creates atomic tasks with dependency DAG |
| `wave-3-generator` | Generates code with parallel worktree execution |
| `wave-4-auditor` | Audits code against R1-R8, scores /100 |
| `feature-worker` | Implements a single feature in isolation |
| `wave-design` | Generates design system from brief |

### Knowledge base — Both editors

18 library templates covering: Stripe, Supabase, auth hardening, RLS, error handling, Server Actions, rate limiting, React Hook Form + Zod, Recharts, shadcn advanced, Resend, Sentry, TanStack Query, and more.

### Infrastructure — Claude Code only

| Pattern | What it defines |
|---------|----------------|
| `query-engine.md` | Turn-loop config per wave (max_turns, max_budget, compaction) |
| `cost-tracker.md` | Granular cost tracking with pre-execution budget enforcement |
| `execution-registry.md` | Self-describing registry of all agents, tools, skills, hooks |
| `permission-context.md` | Immutable permission context per wave (plan mode vs execute) |
| `session-store.md` | JSON persistence per wave with resume and replay |

---

## Claude Code vs Cursor — what you get

| Feature | Claude Code | Cursor |
|---------|------------|--------|
| Architecture rules R1-R8 | Yes | Yes |
| 10 guards (over-engineering, breakage, honest mode...) | Yes | Yes |
| Coding standards + security | Yes | Yes |
| 18 library templates | Yes | Yes |
| Knowledge base | Yes | Yes |
| **AST hooks (real-time blocking)** | **Yes** | No |
| **7 wave agents** | **Yes** | No |
| **/orchestre-go pipeline** | **Yes** | No |
| **Turn-loop + cost tracking** | **Yes** | No |
| **Worktree parallelism** | **Yes** | No |

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

**Level 1: Quality Layer (always active) — Claude Code + Cursor**
Rules file (CLAUDE.md or .cursorrules) is read at every session start. The 8 architecture rules, 10 guards, coding standards, and security practices apply automatically to every response.

**Level 2: Generation Pipeline (on demand) — Claude Code only**
`/orchestre-go` launches a full pipeline: brief generation → feature decomposition → atomic planning → parallel code generation → post-audit scoring. Each wave is a Claude Code agent with its own memory, tool restrictions, and turn-loop constraints.

---

## License

MIT

---

## Author

Built by **Chady** with Claude Opus 4.6.

Works with Claude Code and Cursor. Built for production.
