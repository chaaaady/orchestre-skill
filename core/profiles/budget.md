# Profile: Budget

> Minimum cost, basic quality. For MVPs, prototypes, and learning.

## When to Use

- Prototypes and MVPs
- Learning projects and experiments
- When budget is tight ($1-3 max)
- Simple projects (≤5 features, no billing)
- When you plan to refine manually after generation

## Model Configuration

| Wave | Model | Effort | Cursor Mode |
|------|-------|--------|-------------|
| 0 - Brief Lint | claude-sonnet-4-6 | normal | normal |
| 1 - Decomposition | claude-opus-4-6 | normal | normal |
| Design | claude-sonnet-4-6 | normal | normal |
| 2 - Planning | claude-sonnet-4-6 | normal | normal |
| 3 - Generation (INIT) | claude-sonnet-4-6 | normal | normal |
| 3 - Generation (features) | claude-sonnet-4-6 | normal | normal |
| 4 - Audit | claude-sonnet-4-6 | normal | normal |

## Execution Configuration

| Parameter | Value |
|-----------|-------|
| Parallel execution | **Disabled** (sequential only) |
| Worktrees | **Disabled** |
| Hooks | **pre-write only** (basic architecture guard) |
| Review type | **Basic review** (grep-based, no LSP) |
| Security review | **Disabled** (manual) |
| WebFetch | **Disabled** (offline only, fixed-assets) |
| LSP checks | **Disabled** |
| Design wave | **Disabled** (use brief §4 directly) |

## Plan Depth

- Tasks ≤ 3h max
- `impacted_files` listed per task
- `validation_cmd`: `npm run build` (typecheck optional)
- Basic council checks (C1-C3 only: conflicts, cycles, secrets)
- No LSP checks

## Prompt Detail

- **INIT**: Standards summary only (no examples, just rules)
- **Features**: Acceptance criteria + key instructions. Minimal data model.
- **Design system**: 3-line compact in INIT, inherited in features
- **Copy deck**: Language + tone only
- **Hook reminders**: Basic (pre-write only)

## Verification

- VERIFY.md with minimal checklist (build, auth works, main CRUD works)
- BUG_REPORT.md template included
- Doctor runs 20 checks (legacy only, no V16 additions)
- Basic grep-based review in Wave 4
- No security-review
- No smoke-test execution

## Estimated Cost

| Project Weight | Estimated Cost |
|---------------|---------------|
| XS | $0.25-0.50 |
| S | $0.50-1 |
| M | $1-3 |
| L | $3-5 |
| XL | $3-5 |

## Profile Flag

```bash
ORCHESTRE_PROFILE=budget ./orchestre-v16-kit/run.sh
```

## Limitations

- No parallel execution → slower for large projects
- No security-review → manual security audit recommended before production
- No WebFetch → may use slightly outdated patterns from fixed-assets
- No LSP → Wave 4 audit is grep-based only (structural, not semantic)
- No design wave → design system from brief §4 only (knowledge base defaults)
