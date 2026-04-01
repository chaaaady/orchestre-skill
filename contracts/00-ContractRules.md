# Orchestre V16 -- Contract Rules

> Canonical reference for every agent, hook, and skill in the Orchestre pipeline.
> Version: 16.0.0 | Effective: 2026-04-01

---

## CR-01 -- JSON Formatting

All JSON artefacts produced by Orchestre (orchestre.lock, intent.json, plan.json,
ai-bundle.json, hooks_log.json, actual-costs.json, agent-sessions.json) MUST use:

| Rule | Value |
|------|-------|
| Indent | 2 spaces |
| Trailing commas | forbidden |
| Key order | stable-sorted (alphabetical within each nesting level) |
| Encoding | UTF-8, no BOM |
| Line endings | LF only |

Agents MUST NOT reformat keys they did not change. Diff-friendly output is mandatory.

---

## CR-02 -- Zero-Secret Protocol

No secret, token, key, password, DSN, or connection string may appear in any
Orchestre artefact, generated source file, or log output.

| Pattern | Action |
|---------|--------|
| `sk_live_*`, `sk_test_*` | BLOCK write |
| `ghp_*`, `github_pat_*` | BLOCK write |
| `eyJ*` (JWT bodies) | BLOCK write |
| `NEXT_PUBLIC_` prefix on secret vars | BLOCK write |
| Any string matching `/[a-zA-Z0-9_]{20,}/` adjacent to `key`, `secret`, `token`, `password` | WARN and require confirmation |

Enforcement: `pre-write-guard.sh` (Hook HE-01) and `pre-commit-audit.sh`.

---

## CR-03 -- Immutable Artefact Hashes

Every artefact written to `.orchestre/` MUST have its SHA-256 hash recorded in
`orchestre.lock` under the `hashes` map. If a downstream wave detects a hash
mismatch, it MUST halt and report `INTEGRITY_VIOLATION`.

```
"hashes": {
  "intent.json": "sha256:abcdef...",
  "plan.json": "sha256:123456...",
  ...
}
```

---

## CR-04 -- Wave Gating

No wave may begin until its predecessor has written `WAVE_X_DONE` to
`orchestre.lock` and all predecessor integrity checks pass.

| Wave | Gate condition |
|------|---------------|
| 0 (Brief) | PROJECT.md exists and parses |
| 1 (Intent) | WAVE_0_DONE, brief_lint has zero FATAL |
| 2 (Plan) | WAVE_1_DONE, intent validates against IntentV2 schema |
| 3 (Build) | WAVE_2_DONE, plan validates against PlanV2 schema, doctor_report.fatal = 0 |
| 4 (Audit) | WAVE_3_DONE, all features have status "done" or "rework" |

---

## AM-01 -- Agent Memory Protocol (NEW in V16)

Each wave-agent MUST persist critical outputs to Claude Code memory before
writing `WAVE_X_DONE`. This ensures downstream waves can recover context without
re-reading full artefacts.

| Wave | Required memory keys |
|------|---------------------|
| 0 | `orchestre:brief_summary`, `orchestre:project_weight`, `orchestre:lint_results` |
| 1 | `orchestre:features`, `orchestre:parallel_groups`, `orchestre:design_system` |
| 2 | `orchestre:task_graph`, `orchestre:cost_estimate`, `orchestre:security_tasks` |
| 3 | `orchestre:build_status`, `orchestre:files_written`, `orchestre:errors` |
| 4 | `orchestre:audit_score`, `orchestre:violations`, `orchestre:recommendations` |

Memory keys MUST use the `orchestre:` prefix. Agents MUST NOT overwrite keys
from prior waves unless performing a documented rework cycle.

---

## PI-01 -- Parallel Isolation Protocol (NEW in V16)

Features assigned to the same parallel group MAY execute concurrently. To
prevent file conflicts:

1. Each parallel feature MUST operate in its own git worktree.
2. Worktree branch naming: `orchestre/<feature_id>` (e.g., `orchestre/F01`).
3. No two features in the same parallel group may write to the same file path.
   The plan validator MUST detect shared-file conflicts and reject the plan.
4. After all features in a group complete, the orchestrator merges worktrees
   sequentially in feature_id order.
5. Merge conflicts MUST halt execution and request user resolution via
   `AskUserQuestion`.

Worktree state is tracked in `orchestre.lock` under `parallel_execution.worktrees`.

---

## HE-01 -- Hook Enforcement Protocol (NEW in V16)

Pre-write hooks MUST validate against design system tokens and architecture
rules R1-R8 before any file write during Wave 3.

### Architecture Rules

| Rule | Description | Scope |
|------|-------------|-------|
| R1 | No direct DB calls outside `lib/db/` | `app/`, `components/` |
| R2 | No hardcoded colors -- semantic tokens only | `*.tsx`, `*.css` |
| R3 | No `throw new` in lib -- use `Result<T>` | `lib/` |
| R4 | No `any` type | `*.ts`, `*.tsx` |
| R5 | API routes use middleware chain | `app/api/` |
| R6 | No `console.log` with sensitive data | `*.ts`, `*.tsx` |
| R7 | Imports use `@/` alias | `*.ts`, `*.tsx` |
| R8 | Server/client boundary respected | `app/`, `components/` |

Hook execution is logged to `.orchestre/hooks_log.json`. A hook failure
BLOCKS the write and increments `hooks_log[].result = "blocked"`.

---

## NT-01 -- Native Task Protocol (NEW in V16)

All feature status tracking uses Claude Code native `TaskCreate` / `TaskUpdate`
/ `TaskList` tools. Manual JSON status tracking in `orchestre.lock` is
deprecated.

| Action | Tool | orchestre.lock sync |
|--------|------|---------------------|
| Feature registered | TaskCreate | `task_ids[feature_id] = task_id` |
| Feature in progress | TaskUpdate(status=in_progress) | `feature_status[feature_id] = "building"` |
| Feature done | TaskUpdate(status=completed) | `feature_status[feature_id] = "done"` |
| Feature failed | TaskUpdate(status=failed) | `feature_status[feature_id] = "error"` |

The `task_ids` map in `orchestre.lock` is the bridge between native task tracking
and Orchestre's own state.

---

## HR-01 -- Hybrid Research Protocol (NEW in V16)

| Wave | Network access | Rationale |
|------|---------------|-----------|
| 0 (Brief) | DENIED | Brief is user-provided, no external data needed |
| 1 (Intent) | DENIED | Intent derives from brief only |
| 2 (Plan) | DENIED | Plan derives from intent only |
| 3 (Build) | ALLOWED (whitelist) | May need docs for implementation |
| 4 (Audit) | DENIED | Audit uses local analysis only |

### Whitelisted URLs (Wave 3)

URLs are specified per-project in `intent.json` under `research_urls`. Default
whitelist:

- `https://supabase.com/docs/*`
- `https://docs.stripe.com/*`
- `https://nextjs.org/docs/*`
- `https://ui.shadcn.com/*`
- `https://tailwindcss.com/docs/*`
- `https://zod.dev/*`

Any `WebFetch` call to a non-whitelisted URL MUST be blocked by the orchestrator.

---

## RC-01 -- Real-Time Cost Protocol (NEW in V16)

After each wave completes, the orchestrator MUST:

1. Run `claude cost` (or equivalent) to retrieve actual token usage.
2. Record the result in `orchestre.lock` under `actual_costs[wave]`:

```json
{
  "wave_0": {
    "estimated_usd": 0.12,
    "actual_usd": 0.09,
    "tokens_in": 15200,
    "tokens_out": 3400,
    "model": "claude-opus-4-6"
  }
}
```

3. If `actual_usd > estimated_usd * 1.5`, emit a WARNING to the user.
4. Cumulative cost is reported at the end of each wave.

---

## CR-ENV-01 -- Environment Gating

Orchestre reads configuration from environment variables. Required variables
MUST be validated before Wave 0 begins.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ORCHESTRE_PROFILE` | no | `balanced` | Cost profile: premium, balanced, budget |
| `ORCHESTRE_PARALLEL` | no | `false` | Enable parallel feature execution |
| `ORCHESTRE_MODEL` | no | `claude-opus-4-6` | Default model for wave agents |
| `ORCHESTRE_DRY_RUN` | no | `false` | Validate only, do not write files |
| `ORCHESTRE_RESUME` | no | `false` | Resume from last completed wave |

If `ORCHESTRE_RESUME=true`, the orchestrator reads `agent_sessions` from
`orchestre.lock` and attempts to resume the Claude Code session.

---

## CR-NEXT-01 -- Checkpoint Protocol (Enhanced in V16)

At the end of each wave, the orchestrator MUST:

1. Write `WAVE_X_DONE` to `orchestre.lock`.
2. Persist memory keys (AM-01).
3. Record actual costs (RC-01).
4. Record session ID in `agent_sessions`.
5. Use `AskUserQuestion` to confirm continuation to the next wave (replacing
   the V15 text-marker approach).

The `AskUserQuestion` prompt MUST include:
- Summary of what was completed
- Cost so far (estimated vs actual)
- What the next wave will do
- Option to abort, continue, or adjust parameters

---

## Precedence

If any rule in this document conflicts with a wave-agent's instructions, this
document takes precedence. Wave-agents inherit these rules implicitly.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 15.0.0 | 2025-11-01 | Initial contract rules (CR-01 through CR-NEXT-01) |
| 16.0.0 | 2026-04-01 | Added AM-01, PI-01, HE-01, NT-01, HR-01, RC-01. Enhanced CR-NEXT-01. |
