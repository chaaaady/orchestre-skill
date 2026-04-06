# Profile: Balanced

> Recommended default. Good quality/cost ratio for most projects.

## When to Use

- Most projects (standard SaaS, web apps, e-commerce)
- When you want solid quality without excessive cost
- Projects with 4-10 features
- Estimated cost: $5-15

## Model Configuration

| Wave | Model | Effort | Cursor Mode |
|------|-------|--------|-------------|
| 0 - Brief Lint | claude-sonnet-4-6 | normal | normal |
| 1 - Decomposition | claude-opus-4-6 | max | max |
| Design | claude-sonnet-4-6 | normal | normal |
| 2 - Planning | claude-opus-4-6 | max | max |
| 3 - Generation (INIT) | claude-opus-4-6 | max | max |
| 3 - Generation (features) | claude-sonnet-4-6 | normal | normal |
| 4 - Audit | claude-sonnet-4-6 | normal | normal |

## Execution Configuration

| Parameter | Value |
|-----------|-------|
| Parallel execution | **Enabled** if >5 features |
| Worktrees | **Enabled** for parallel groups only |
| Hooks | **pre-write + post-write** (no pre-commit) |
| Review type | **Standard review** (single pass) |
| Security review | **Auth + billing tasks only** |
| WebFetch | **Critical docs only** (Supabase auth, Stripe API) |
| LSP checks | **Enabled** in Wave 4 (basic) |
| Design wave | **Enabled** (parallel with Wave 1) |

## Plan Depth

- Tasks ≤ 3h max
- `impacted_files` listed per task
- `validation_cmd`: `npm run build && npm run typecheck`
- Full council checks (9/9)
- LSP checks on auth/billing tasks

## Prompt Detail

- **INIT**: Full coding standards (condensed) + key examples (Result pattern, AppError)
- **Features**: Data model (SQL + Zod) + user flows + acceptance criteria. Code examples for auth/billing only.
- **Design system**: Full in INIT, 6-line compact in features
- **Copy deck**: Compact in all prompts
- **Hook reminders**: Included in every prompt

## Verification

- VERIFY.md with essential checklist (build, auth, main CRUD, billing)
- BUG_REPORT.md template included
- Doctor runs all 26 checks
- Standard review in Wave 4
- security-review on auth/billing tasks
- smoke-test.sh generated but not auto-executed

## Estimated Cost

| Project Weight | Estimated Cost |
|---------------|---------------|
| XS | $1-3 |
| S | $3-6 |
| M | $5-15 |
| L | $12-25 |
| XL | $15-30 |

## Profile Flag

```bash
ORCHESTRE_PROFILE=balanced ./orchestre-v16-kit/run.sh
# Or simply (balanced is default):
./orchestre-v16-kit/run.sh
```
