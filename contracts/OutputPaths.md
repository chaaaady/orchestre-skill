# OutputPaths Contract

> Defines all file paths and directory structures used by Orchestre V16.
> Reference for: All waves, hooks, skills, and the orchestrator.

---

## Directory Overview

```
project-root/
├── PROJECT.md                          # User brief (input)
├── .orchestre/                          # Orchestre working directory
│   ├── orchestre.lock                   # State (StateV2)
│   ├── intent.json                     # IntentV2 output
│   ├── plan.json                       # PlanV2 output
│   ├── ai-bundle.json                  # Assembled AiBundleV16
│   ├── brief-lint.json                 # Wave 0 lint results
│   ├── doctor-report.json              # Pre-build validation
│   ├── agent-sessions.json             # Session IDs for resume (NEW)
│   ├── actual-costs.json               # Real costs per wave (NEW)
│   ├── hooks_log.json                  # Hook execution log
│   ├── AUDIT_REPORT.md                 # Wave 4 audit output (NEW location)
│   ├── orchestre.lock.pid              # Lock file for concurrent writes
│   └── .worktrees/                     # Parallel execution worktrees
│       ├── F01/                        # Worktree for feature F01
│       ├── F02/                        # Worktree for feature F02
│       └── ...
├── output/                             # Generated project output
│   ├── app/                            # Next.js App Router
│   │   ├── (auth)/                     # Auth route group
│   │   ├── (dashboard)/                # Dashboard route group
│   │   ├── api/                        # API routes
│   │   ├── layout.tsx                  # Root layout
│   │   ├── page.tsx                    # Landing page
│   │   ├── globals.css                 # Global styles with design tokens
│   │   └── global-error.tsx            # Global error boundary
│   ├── components/                     # UI components
│   │   ├── ui/                         # shadcn/ui base components
│   │   ├── forms/                      # Form components
│   │   └── layouts/                    # Layout components
│   ├── lib/                            # Business logic
│   │   ├── auth/                       # Auth utilities
│   │   ├── billing/                    # Payment logic
│   │   ├── db/                         # Database queries
│   │   ├── supabase/                   # Supabase clients
│   │   ├── types/                      # TypeScript types
│   │   ├── utils/                      # Utility functions
│   │   └── validators/                 # Zod schemas
│   ├── public/                         # Static assets
│   ├── middleware.ts                   # Next.js middleware
│   ├── package.json                    # Dependencies
│   ├── tsconfig.json                   # TypeScript config
│   ├── tailwind.config.ts              # Tailwind config
│   ├── next.config.ts                  # Next.js config
│   ├── .env.example                    # Environment variable template
│   └── .gitignore                      # Git ignore rules
├── .claude/                            # Claude Code configuration (NEW)
│   ├── settings.json                   # Hooks + permissions
│   ├── agents/                         # Wave agent definitions
│   │   ├── wave-brief.md               # Wave 0 agent
│   │   ├── wave-intent.md              # Wave 1 agent
│   │   ├── wave-plan.md                # Wave 2 agent
│   │   ├── wave-build.md               # Wave 3 agent (template)
│   │   └── wave-audit.md               # Wave 4 agent
│   └── rules/                          # Path-specific linting rules
│       ├── app.md                      # Rules for app/ directory
│       ├── components.md               # Rules for components/ directory
│       ├── lib.md                      # Rules for lib/ directory
│       └── api.md                      # Rules for app/api/ directory
└── hooks/                              # Hook scripts
    ├── pre-write-guard.sh              # Design system + architecture validation
    ├── post-write-check.sh             # Post-write typecheck + directive check
    └── pre-commit-audit.sh             # Security audit before commit
```

---

## .orchestre/ Directory

The `.orchestre/` directory contains all Orchestre artefacts and state. It is
created by Wave 0 and updated by every subsequent wave.

### Files

| File | Created by | Updated by | Format |
|------|-----------|-----------|--------|
| `orchestre.lock` | Wave 0 | All waves | JSON (StateV2) |
| `intent.json` | Wave 1 | Never (immutable after creation) | JSON (IntentV2) |
| `plan.json` | Wave 2 | Wave 3 (real_cost_usd updates only) | JSON (PlanV2) |
| `ai-bundle.json` | Orchestrator | Orchestrator (after each wave) | JSON (AiBundleV16) |
| `brief-lint.json` | Wave 0 | Never | JSON |
| `doctor-report.json` | Wave 2 | Never | JSON |
| `agent-sessions.json` | Wave 0 | All waves | JSON |
| `actual-costs.json` | Wave 0 | All waves | JSON |
| `hooks_log.json` | Wave 3 | Wave 3 (append-only) | JSON |
| `AUDIT_REPORT.md` | Wave 4 | Never | Markdown |
| `orchestre.lock.pid` | Orchestrator | Orchestrator | Plain text (PID) |

### agent-sessions.json

Stores Claude Code session IDs for resume capability. Updated after each wave.

```json
{
  "wave_0": {
    "session_id": "session_abc123",
    "started_at": "2026-04-01T10:00:00.000Z",
    "finished_at": "2026-04-01T10:02:00.000Z",
    "model": "claude-opus-4-6"
  },
  "wave_1": {
    "session_id": "session_def456",
    "started_at": "2026-04-01T10:02:30.000Z",
    "finished_at": "2026-04-01T10:05:00.000Z",
    "model": "claude-opus-4-6"
  }
}
```

### actual-costs.json

Stores real cost data retrieved via `claude cost` after each wave.

```json
{
  "wave_0": {
    "estimated_usd": 0.12,
    "actual_usd": 0.09,
    "tokens_in": 15200,
    "tokens_out": 3400,
    "model": "claude-opus-4-6",
    "duration_seconds": 45.2,
    "recorded_at": "2026-04-01T10:02:00.000Z"
  },
  "cumulative": {
    "estimated_usd": 1.42,
    "actual_usd": 1.18,
    "total_tokens_in": 142000,
    "total_tokens_out": 48000
  }
}
```

### AUDIT_REPORT.md

Wave 4 produces a human-readable audit report covering:

- Architecture compliance (R1-R8 checks)
- Security review findings
- Design system adherence
- Performance concerns (N+1 queries, bundle size)
- Accessibility checks
- Recommendations for production readiness

---

## output/ Directory

The `output/` directory contains the generated project source code. It is a
complete, runnable Next.js project after Wave 3 completes.

### Path Rules

| Rule | Description |
|------|-------------|
| No files outside output/ | Wave 3 agents MUST NOT write files outside `output/` (except `.orchestre/` state updates) |
| @/ alias | All imports within output/ use the `@/` path alias |
| Route groups | Auth pages in `(auth)/`, dashboard in `(dashboard)/` |
| DB isolation | All database queries in `lib/db/` |
| Auth isolation | All auth logic in `lib/auth/` |
| Billing isolation | All payment logic in `lib/billing/` |
| Component hierarchy | `ui/` for primitives, domain components at `components/` root |

---

## .claude/ Directory (NEW in V16)

The `.claude/` directory contains Claude Code configuration for the Orchestre
pipeline.

### settings.json

Central configuration for hooks and per-wave permissions. See
`hooks/settings.json` for the full specification.

### agents/

Wave agent definition files. Each file contains the system prompt, constraints,
and tool permissions for one wave agent. These are referenced by the orchestrator
when spawning sub-agents.

| Agent | File | Tools |
|-------|------|-------|
| wave-brief | `agents/wave-brief.md` | Read, Glob, Grep, AskUserQuestion |
| wave-intent | `agents/wave-intent.md` | Read, Glob, Grep, AskUserQuestion, TaskCreate |
| wave-plan | `agents/wave-plan.md` | Read, Glob, Grep, TaskCreate, TaskUpdate, TaskList |
| wave-build | `agents/wave-build.md` | All tools (within output/ scope) |
| wave-audit | `agents/wave-audit.md` | Read, Glob, Grep, Bash |

### rules/

Path-specific linting rules loaded by Claude Code when editing files in specific
directories. These supplement the hook-based enforcement.

| Rule file | Applies to | Key rules |
|-----------|-----------|-----------|
| `app.md` | `output/app/**` | Use server components by default, 'use client' only when needed |
| `components.md` | `output/components/**` | Semantic tokens only, accessibility required |
| `lib.md` | `output/lib/**` | Result<T> error handling, no throw, typed exports |
| `api.md` | `output/app/api/**` | Middleware chain, input validation, rate limiting |

---

## File Naming Conventions

| Convention | Example | Scope |
|------------|---------|-------|
| kebab-case for directories | `route-groups/` | All |
| kebab-case for non-component files | `auth-client.ts` | `lib/` |
| PascalCase for React components | `InvoiceList.tsx` | `components/` |
| camelCase for utilities | `formatCurrency.ts` | `lib/utils/` |
| Route files | `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` | `app/` |
| API routes | `route.ts` | `app/api/` |

---

## .gitignore Requirements

The generated `.gitignore` MUST include:

```
node_modules/
.next/
.env
.env.local
.env.production
.orchestre/orchestre.lock.pid
.orchestre/agent-sessions.json
.worktrees/
```

The following MUST NOT be gitignored (they are committed):

```
.orchestre/orchestre.lock
.orchestre/intent.json
.orchestre/plan.json
.orchestre/AUDIT_REPORT.md
.env.example
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 15.0.0 | 2025-11-01 | Initial output paths |
| 16.0.0 | 2026-04-01 | Added .claude/ directory, agent-sessions.json, actual-costs.json, AUDIT_REPORT.md in .orchestre/. Added .worktrees/ for parallel execution. |
