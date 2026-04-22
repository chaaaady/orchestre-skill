# Changelog

All notable changes to Orchestre are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is [SemVer](https://semver.org/).

## [4.0.0] — 2026-04-22

> **Theme: markdown → runtime.** The 5 phases below convert `core/infrastructure/*.md` from declarative specs to runtime enforcement. 166 tests → 308 tests, 0 regressions. Orchestre now enforces what it promises.

### Added — Phase 1: Runtime foundations
- `core/runtime/state-store.mjs` — append-only `events.jsonl` + atomic `snapshot.json`; crash-safe rebuild via `rebuildSnapshot()`.
- `core/runtime/cost-tracker.mjs` — Opus/Sonnet/Haiku pricing, `record()`, `guardBudget()`, typed `BudgetExceededError`.
- `core/runtime/sandbox.mjs` — macOS Seatbelt (`sandbox-exec`) + Linux `bubblewrap`, default write-roots scoped to project.
- `core/hooks/budget-guard.mjs` — PostToolUse kill-switch. Exits 2 past 120 % of `max_usd`, persists `wave_end { stop_reason: "budget_exceeded" }` + `BUDGET_KILLED` sentinel for resume.
- Wave 3 agent documents the sandbox contract explicitly.

### Added — Phase 2: Turn-loop & permission gates
- `core/runtime/turn-loop.mjs` — `DEFAULT_LIMITS` per wave (mirrors query-engine.md), `assertTurnBudget()`, `compactNeeded()`, typed `MaxTurnsExceededError` / `MaxTokensExceededError`. Overridable via `.orchestre/turn-limits.json`.
- `core/runtime/permission-context.mjs` — pure `decide(context, toolName, filePath)`: allow wildcard, `deny_names`, `deny_prefixes`, `write_restrict`. Defaults mirror permission-context.md per-wave spec.
- `core/hooks/permission-guard.mjs` — PreToolUse gate. Parses `TOOL_INPUT`, resolves `activeWave` from `ORCHESTRE_WAVE` env or snapshot, exits 2 + persists `permission_denial` event.

### Added — Phase 3: Contracts runtime + e2e + honesty pass
- `core/runtime/contract-guard.mjs` — wraps `core/contracts/validate.mjs` with `validateContract()` / `assertContract()` + in-process schema cache. `assertContract` persists `contract_violation` events.
- `core/contracts/validate.mjs` — added exports (`SchemaValidator`, `loadSchema`, `listSchemas`) and gated the CLI entry point behind `import.meta.url`. Non-breaking: `npm run validate` unchanged.
- `__tests__/e2e/pipeline.test.mjs` — simulates Wave 0→4 with runtime primitives (no LLM, no network, no spawn). 11 tests across happy path, budget kill mid-wave, permission enforcement, turn-loop exhaustion, crash recovery, append-only invariant.
- `README.md` — "AST-based hooks" replaced with accurate scope: AST for TS architecture, regex for lexical patterns (secrets, colors, import paths).
- `examples/*/GENERATED_BY_ORCHESTRE.md` — flagged as curated examples with illustrative cost/duration estimates, not real `/orchestre-go` outputs.

### Added — Phase 4: Procedural memory + plan gate
- `core/runtime/memory.mjs` — `recordRejection()`, `getLearnedPatterns({ threshold=3 })`, `renderLearnedMarkdown()`, `updateLearnedPatternsFile()` with atomic write + no-op-if-unchanged.
- `core/runtime/plan-gate.mjs` — 10-sec checkpoint before Wave 3 à la Devin 2.0. `summarizePlan()`, `renderPrompt()`, `parseResponse()` with liberal matching, `isNonInteractive()` (CI / `ORCHESTRE_NO_GATE=1` / non-TTY → auto-approve).
- Wave 2 agent invokes plan-gate before `WAVE_2_DONE`. Wave 4 agent feeds rejections into memory.

### Added — Phase 5: Mutation score + SvelteKit knowledge parity
- `core/runtime/mutation-score.mjs` — stryker-js harness (no new dep). `classifyPath()`, `parseStrykerReport()`, `assertMutationScore()` with typed `MutationScoreBelowThresholdError`. Category thresholds: critical ≥70 %, standard ≥50 %, experimental ≥30 %.
- 3 new SvelteKit knowledge files: `sentry-sveltekit.md`, `resend-sveltekit.md`, `tanstack-query-svelte.md`. `stacks/sveltekit-drizzle/stack.json` `knowledge_base` updated.

### Opt-in features
- **Mutation score** is **opt-in**: Wave 4 auditor invokes it only when `@stryker-mutator/core` is present in the target project (profile: premium). Balanced / budget profiles keep the architecture-only score.
- **Sandbox Wave 3** falls back to unsandboxed spawn with an explicit warning when no backend is detected (e.g., non-Linux/macOS).
- **Plan gate** auto-approves in CI / non-TTY / `ORCHESTRE_NO_GATE=1` and still persists a `plan_gate_decision` event for audit trail.

### Changed
- `bin/verify.mjs` — now checks for all runtime modules + detects sandbox backend.
- `core/contracts/validate.mjs` — gated CLI entry (non-breaking); enables `import`-time usage from `core/runtime/contract-guard.mjs`.

### Removed
- `requests/PROMPT_TEAM_NEXT16.md` — vague brief bundling unrelated goals (`--team` multi-agent + Next.js 16.2 bump). `--team` needs a proper RFC once CLI-driven wave execution lands; the Next.js bump is irrelevant to Orchestre (it's a Node.js CLI framework, not a Next.js app).

### Metrics
- Tests: **166 → 308** (+142, 0 regressions).
- New runtime modules: **10** (+ 2 hooks).
- New knowledge files: **3** (SvelteKit parity batch 1/2).

### Known follow-ups (post-4.0)
- CI badge in README once the first green run completes.
- Examples (`examples/saas-nextjs`, `examples/saas-sveltekit`) still non-runnable — scope intentionally capped at curated patterns for 4.0. `examples/runtime-demo/` ships a small runnable demonstration of the runtime primitives instead.
- Third stack (T3 / Remix / Next+Drizzle) deferred — needs genuine shipped-in-prod expertise, not LLM-sourced patterns.
- Web dashboard (`tools/dashboard.html`) ships as a static proof-of-concept; richer dashboard deferred.

---

## [3.0.0] — before 2026-04-22

Multi-stack architecture, 8 skills, 166 tests, audit fixes. See git log `3b32cb8` for history pre-4.0.
