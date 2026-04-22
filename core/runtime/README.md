# core/runtime — API reference

The **runtime layer** turns `core/infrastructure/*.md` from declarative specs into physical enforcement. Every module is zero-dependency (plain Node.js stdlib) and fully unit-tested in `__tests__/runtime/`.

All modules read and write under `<projectRoot>/.orchestre/state/`:

```
.orchestre/
  state/
    events.jsonl   ← append-only log, source of truth
    snapshot.json  ← derived cache, rebuildable via rebuildSnapshot()
  budget.json      ← optional, opt-in budget config
  turn-limits.json ← optional, per-wave override of query-engine.md defaults
  permissions.json ← optional, per-wave override of permission-context.md defaults
```

Tests: `__tests__/runtime/<module>.test.mjs` (one file per module) + `__tests__/e2e/pipeline.test.mjs` (end-to-end).

---

## state-store.mjs

Append-only event log + incremental snapshot.

```ts
init(projectRoot) → { dir, events, snapshot, snapshotTmp }
append(projectRoot, event) → event         // event.type is required
read(projectRoot, filter?) → Event[]       // filter: { wave?, type? }
snapshot(projectRoot) → SnapshotState
rebuildSnapshot(projectRoot) → SnapshotState   // re-derives from events.jsonl
```

**Event types handled by the reducer**: `wave_start`, `wave_end`, `turn`, `cost`, `permission_denial`, `contract_violation`, `rejection`, `plan_gate_decision`, `mutation_score_pass`, `mutation_score_fail`.

Crash safety: `events.jsonl` is append-only with `O_APPEND`; `snapshot.json` uses atomic `rename` via `.tmp`.

## cost-tracker.mjs

```ts
PRICING                                                    // Opus / Sonnet / Haiku
priceOf(model) → { in, out } | null
estimateCost({ model, tokens_in, tokens_out }) → usd
record(root, { wave, label?, model, tokens_in, tokens_out, stop_reason? })
totalSoFar(root) → { usd, tokens_in, tokens_out }
remaining(root, budgetUsd) → number (clamped at 0)
projectedCostBeforeExecute(root, { model, tokens_in, tokens_out, wave }, budgetUsd) → {..., wouldExceed}
guardBudget(root, budgetUsd, { wave, label }) → { spent, remaining }
class BudgetExceededError
```

## turn-loop.mjs

```ts
DEFAULT_LIMITS                                            // wave 0..4 + 3-init + design
loadLimits(root)                                          // merges .orchestre/turn-limits.json
getLimits(wave, overrides?) → { max_turns, max_budget_tokens, compact_after } | null
recordTurn(root, { wave, tokens_in?, tokens_out?, label? })
state(root, wave) → { turnsUsed, tokensUsed }
assertTurnBudget(root, wave, overrides?)                  // throws on exceed
compactNeeded(root, wave, overrides?) → boolean
class MaxTurnsExceededError
class MaxTokensExceededError
```

## sandbox.mjs

```ts
DEFAULT_WRITE_ROOTS                                       // src, app, lib, components, actions, pages, public, .orchestre/state
detect() → { backend: 'seatbelt' | 'bubblewrap' | 'none', path?, reason? }
buildSeatbeltProfile({ projectRoot, writeRoots, allowNetwork }) → string   // .sb text
buildCommand(detected, { projectRoot, writeRoots, allowNetwork, argv }) → { cmd, args, profilePath? }
run({ projectRoot, argv, writeRoots?, allowNetwork?, env? }) → Promise<{ sandboxed, backend?, exitCode, signal?, reason? }>
```

Fail-safe: when no backend is available, `run()` resolves with `sandboxed: false` and a `reason` string — caller decides whether to proceed.

## permission-context.mjs

```ts
DEFAULT_CONTEXTS                                          // per-wave allow/deny
loadContexts(root)
contextFor(wave, contexts?) → context | null
decide({ context, toolName, filePath }) → { allowed, rule?, reason? }
```

Rules (in order): `deny_prefixes` → `deny_names` → `allow` (wildcard or list) → `write_restrict` (path prefix check for Write/Edit).

## plan-gate.mjs

Devin-2.0-style 10-sec checkpoint between Wave 2 and Wave 3.

```ts
DEFAULT_TIMEOUT_SECONDS = 60
summarizePlan(plan) → { valid, tasks, features, parallel_groups, cost_total_usd, council_warnings, profile, ... }
renderPrompt(summary) → string                            // AskUserQuestion payload
parseResponse(answer, { defaultDecision }) → 'go' | 'replan' | 'abort'
isNonInteractive() → boolean                              // ORCHESTRE_NO_GATE=1 | CI | non-TTY
evaluate(root, plan, { answer?, defaultDecision?, nonInteractive? }) → { decision, summary, prompt }
```

Persists a `plan_gate_decision` event regardless of interactive mode (audit trail).

## memory.mjs

Procedural memory — rejections aggregate across runs.

```ts
DEFAULT_THRESHOLD = 3
recordRejection(root, { pattern, context?, reason?, wave?, source? })
getLearnedPatterns(root, { threshold? }) → [{ pattern, count, contexts[], reasons[], first, last }]   // desc by count
renderLearnedMarkdown(root, { threshold? }) → string
updateLearnedPatternsFile(repoRoot, projectRoot, { threshold?, filePath? }) → { path, updated, count }
```

`updateLearnedPatternsFile` is atomic (`.tmp` + rename) and no-ops when content is unchanged.

## contract-guard.mjs

Runtime validation against the JSON Schemas in `core/contracts/schemas/`.

```ts
availableContracts() → string[]                           // e.g. ['BriefLint', 'IntentV2', 'PlanV2', 'StateV2', 'AiBundleV16']
validateContract(name, data) → { valid, errors, unknown }
assertContract(root, name, data, { wave?, label? })       // throws + persists 'contract_violation' event
clearCache()
class ContractViolationError
```

Schema cache is process-local. `validateContract` is permissive on unknown schemas (returns `valid:true, unknown:true`) so optional contracts don't break the harness; `assertContract` fails fast on unknown schemas.

## mutation-score.mjs

Opt-in quality gate — harness around stryker-js (not a dependency).

```ts
DEFAULT_THRESHOLDS = { critical: 70, standard: 50, experimental: 30 }
classifyPath(path) → 'critical' | 'standard' | 'experimental'
parseStrykerReport(rawOrPath) → { valid, mutationScore, totals, files }
assertMutationScore(report, { thresholds?, projectRoot, label?, wave? })
summary(report)
class MutationScoreBelowThresholdError
```

Enforces **per-file** thresholds bucketed by category (auth/billing/webhook/crypto/rls = critical). Persists `mutation_score_pass` / `mutation_score_fail` events.

---

# core/hooks — runtime gates

## budget-guard.mjs  *(PostToolUse)*

Reads `.orchestre/budget.json` + snapshot; exits 2 past `kill_threshold_pct` of `max_usd`, writes `BUDGET_KILLED` sentinel, appends `wave_end { stop_reason: "budget_exceeded" }`.

Config shape:
```json
{ "max_usd": 10, "kill_threshold_pct": 120, "warn_threshold_pct": 75 }
```

## permission-guard.mjs  *(PreToolUse)*

Parses `TOOL_INPUT` (`tool_name` nested or flat), resolves `activeWave` from `ORCHESTRE_WAVE` env or snapshot, runs `decide()` from `permission-context.mjs`, exits 2 + persists `permission_denial` event on block.

## orchestre-guard.mjs  *(PreWrite / PostWrite / PreCommit)*

Pre-existing entry point for pre-write AST/regex checkers. Unchanged by the runtime work.

---

## Composition guarantees

- **Source of truth**: `events.jsonl` never mutates retroactively. Every snapshot is rebuildable from it.
- **Atomic writes**: snapshots, learned-patterns, stack config — all use `.tmp` + `rename`.
- **Fail-open hooks**: any internal hook error exits 0, the guard never blocks on its own bugs.
- **Typed errors**: every `assert*` throws a named subclass of `Error` with structured properties (wave, limit, category, …) for clean catch-sites.
- **No external deps**: runtime modules import only from `node:*`. Stryker (for mutation) and bubblewrap/sandbox-exec (for sandboxing) are external and optional.

See `examples/runtime-demo/` for a zero-LLM runnable demonstration that exercises every module end-to-end.
