# Profile: Premium

> Maximum quality, full automation, deep verification.

## When to Use

- High-value projects (client-facing SaaS, funded startups)
- Projects where code quality is non-negotiable
- When budget is not a concern ($5-15 per project)
- Complex architectures (>8 features, billing, real-time)

## Model Configuration

| Wave | Model | Effort | Cursor Mode |
|------|-------|--------|-------------|
| 0 - Brief Lint | claude-sonnet-4-6 | normal | normal |
| 1 - Decomposition | claude-opus-4-6 | max | max |
| Design | claude-opus-4-6 | max | max |
| 2 - Planning | claude-opus-4-6 | max | max |
| 3 - Generation (INIT) | claude-opus-4-6 | max | max |
| 3 - Generation (features) | claude-opus-4-6 | normal | normal |
| 4 - Audit | claude-opus-4-6 | normal | normal |

## Execution Configuration

| Parameter | Value |
|-----------|-------|
| Parallel execution | **Enabled** (always) |
| Worktrees | **Enabled** for all parallel groups |
| Hooks | **All** (pre-write + post-write + pre-commit) |
| Review type | **ultrareview** (multi-pass) |
| Security review | **All tasks** (not just auth/billing) |
| WebFetch | **Enabled** (all whitelisted URLs) |
| LSP checks | **Enabled** in Wave 4 |
| Design wave | **Enabled** (parallel with Wave 1) |

## Plan Depth

- Tasks ≤ 3h max
- `impacted_files` listed per task with exact paths
- `validation_cmd`: `npm run build && npm run typecheck && npm run lint`
- Full council checks (9/9)
- LSP checks on all tasks

## Prompt Detail

- **INIT**: Full coding standards with all examples (Result pattern, AppError, Zod, RLS, singletons)
- **Features**: Full data model (SQL + Zod) + user flows + edge cases + code examples for every pattern
- **Design system**: Full in INIT, 6-line compact in features
- **Copy deck**: Full in INIT, 4-line compact in features
- **Hook reminders**: Included in every prompt

## Verification

- VERIFY.md with comprehensive checklist (build, lint, typecheck, auth, every CRUD, billing, edge cases)
- BUG_REPORT.md template included
- Doctor runs all 26 checks
- ultrareview multi-pass (architecture + security + design + performance)
- security-review on all tasks
- Automated smoke-test.sh execution

## Estimated Cost

| Project Weight | Estimated Cost |
|---------------|---------------|
| micro | $2-4 |
| light | $4-8 |
| standard | $8-15 |
| heavy | $15-25 |

## Profile Flag

```bash
ORCHESTRE_PROFILE=premium ./orchestre-v16-kit/run.sh
# Or per-wave:
ORCHESTRE_PROFILE=premium claude --model claude-opus-4-6 --agent .claude/agents/wave-1-decomposer.md
```
