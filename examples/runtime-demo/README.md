# Orchestre Runtime Demo

A **genuinely runnable** demonstration of Orchestre's runtime primitives — no LLM, no API keys, no external services. Pure Node.js, zero dependencies.

## What it does

Simulates a full Wave 0 → Wave 4 pipeline using the real runtime modules:

1. **Wave 0** (lint) — records a turn + cost. Permission gate allows it.
2. **Wave 1** (decompose) — runs 2 turns. Demonstrates budget accumulation.
3. **Wave 2** (plan) — ends with the **plan gate** checkpoint (auto-approved in non-interactive mode).
4. **Wave 3** (generate) — 3 feature turns. Budget stays under limit.
5. **Wave 4** (audit) — records 3 rejections of the same pattern (`any-type-in-api`). The 3rd rejection triggers `learned-patterns.md` auto-generation.

It exercises:

- `state-store` — every event is appended to `.orchestre/state/events.jsonl`
- `cost-tracker` — USD + tokens accumulated per wave
- `turn-loop` — token/turn budget checks before each turn
- `permission-context` — tool allow/deny decisions per wave
- `plan-gate` — the Devin-2.0-style checkpoint
- `memory` — learns from repeated rejections

## Run it

```bash
cd examples/runtime-demo
node demo.mjs
```

Expected output (last few lines):

```
✔ Wave 0 completed — 1 turn, ~$0.019
✔ Wave 1 completed — 2 turns, ~$0.225
✔ Wave 2 completed — plan gate: go
✔ Wave 3 completed — 3 turns, ~$0.068
✔ Wave 4 completed — 3 rejections recorded
→ Learned pattern written to /tmp/…/core/memory/learned-patterns.md

Total cost:   $0.32
Total turns:  6
Total events: 17
Events log:   /tmp/…/.orchestre/state/events.jsonl
```

## Inspect the events

```bash
cat /tmp/orchestre-demo-*/.orchestre/state/events.jsonl | jq -c
```

Open `tools/dashboard.html` and load the `events.jsonl` file for a visual timeline.

## What this proves

- The runtime modules compose correctly without an LLM.
- A real Wave 0 → Wave 4 data flow is reproducible locally.
- Budget / permission / turn-loop guards are enforceable from a regular Node script.
- Memory learns across events, not just runs.

Everything you see here is the same code paths that `/orchestre-go` uses in production.
