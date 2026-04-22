/**
 * Pipeline e2e — simulates a full Wave 0→4 run using only runtime primitives.
 *
 * No LLM, no network, no spawn. The point is to prove that Phase 1 + Phase 2
 * primitives compose correctly across a realistic pipeline:
 *   - state transitions (wave_start → turns → cost → wave_end)
 *   - cost accumulation and budget kill-switch
 *   - permission gates allow/deny per wave
 *   - resume-ability (events.jsonl survives, snapshot rebuildable)
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { append, init, read, snapshot, rebuildSnapshot } from '../../core/runtime/state-store.mjs';
import { record, totalSoFar } from '../../core/runtime/cost-tracker.mjs';
import { recordTurn, assertTurnBudget, MaxTurnsExceededError, state as turnState } from '../../core/runtime/turn-loop.mjs';
import { DEFAULT_CONTEXTS, decide } from '../../core/runtime/permission-context.mjs';
import { evaluate as evaluateBudget, main as budgetGuardMain } from '../../core/hooks/budget-guard.mjs';
import { main as permGuardMain } from '../../core/hooks/permission-guard.mjs';

let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orchestre-e2e-'));
  init(root);
  process.env.ORCHESTRE_PROJECT_ROOT = root;
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env.ORCHESTRE_PROJECT_ROOT;
  delete process.env.ORCHESTRE_WAVE;
  delete process.env.TOOL_INPUT;
});

// --- test helpers --------------------------------------------------------

function startWave(wave)  { append(root, { type: 'wave_start', wave }); }
function endWave(wave, stop = 'completed') { append(root, { type: 'wave_end', wave, data: { stop_reason: stop } }); }
function simulateTurn({ wave, tokens_in, tokens_out, model = 'claude-sonnet-4-6' }) {
  // record() emits the cost event (tokens + usd). Then bump the turn counter
  // with a token-less turn event to avoid double-counting.
  record(root, { wave, model, tokens_in, tokens_out });
  append(root, { type: 'turn', wave });
}

// --- tests ---------------------------------------------------------------

describe('pipeline e2e — happy path Wave 0→4', () => {
  it('transitions all waves and accumulates cost correctly', () => {
    // Wave 0 — Lint (1 turn)
    startWave(0);
    simulateTurn({ wave: 0, tokens_in: 2500, tokens_out: 1200 });
    endWave(0);

    // Wave 1 — Decompose (2 turns)
    startWave(1);
    simulateTurn({ wave: 1, tokens_in: 5000, tokens_out: 3000, model: 'claude-opus-4-6' });
    simulateTurn({ wave: 1, tokens_in: 8000, tokens_out: 5000, model: 'claude-opus-4-6' });
    endWave(1);

    // Wave 2 — Plan (1 turn)
    startWave(2);
    simulateTurn({ wave: 2, tokens_in: 4000, tokens_out: 2500, model: 'claude-opus-4-6' });
    endWave(2);

    // Wave 3 — Generate (3 turns)
    startWave(3);
    simulateTurn({ wave: 3, tokens_in: 6000, tokens_out: 8000 });
    simulateTurn({ wave: 3, tokens_in: 6000, tokens_out: 8000 });
    simulateTurn({ wave: 3, tokens_in: 6000, tokens_out: 8000 });
    endWave(3);

    // Wave 4 — Audit (1 turn)
    startWave(4);
    simulateTurn({ wave: 4, tokens_in: 3000, tokens_out: 1500 });
    endWave(4);

    const snap = snapshot(root);
    assert.equal(snap.activeWave, 4);
    for (const w of [0, 1, 2, 3, 4]) {
      assert.ok(snap.byWave[w].started_at, `wave ${w} missing started_at`);
      assert.ok(snap.byWave[w].ended_at, `wave ${w} missing ended_at`);
      assert.equal(snap.byWave[w].stop_reason, 'completed');
    }

    // Totals sanity
    assert.ok(snap.costSoFar.usd > 0);
    assert.equal(snap.turnCount, 8);
  });

  it('state survives corruption — rebuildSnapshot recovers from events.jsonl', () => {
    startWave(0);
    simulateTurn({ wave: 0, tokens_in: 1000, tokens_out: 500 });
    startWave(1);
    simulateTurn({ wave: 1, tokens_in: 5000, tokens_out: 2000, model: 'claude-opus-4-6' });

    // Corrupt the snapshot file
    const snapPath = join(root, '.orchestre', 'state', 'snapshot.json');
    writeFileSync(snapPath, 'garbage{{');

    const rebuilt = rebuildSnapshot(root);
    assert.equal(rebuilt.turnCount, 2);
    assert.ok(rebuilt.costSoFar.usd > 0);
    assert.equal(rebuilt.activeWave, 1);
  });
});

describe('pipeline e2e — budget kill mid-wave', () => {
  it('budget-guard kills Wave 3 after overspend, writes wave_end + sentinel, preserves history', async () => {
    mkdirSync(join(root, '.orchestre'), { recursive: true });
    writeFileSync(join(root, '.orchestre', 'budget.json'),
      JSON.stringify({ max_usd: 5, kill_threshold_pct: 120, warn_threshold_pct: 75 }));

    // Waves 0-2 stay cheap
    startWave(0); simulateTurn({ wave: 0, tokens_in: 1000, tokens_out: 500 }); endWave(0);
    startWave(1); simulateTurn({ wave: 1, tokens_in: 2000, tokens_out: 1000 }); endWave(1);
    startWave(2); simulateTurn({ wave: 2, tokens_in: 2000, tokens_out: 1000 }); endWave(2);

    // Wave 3 — overspend with opus
    startWave(3);
    simulateTurn({ wave: 3, tokens_in: 500_000, tokens_out: 200_000, model: 'claude-opus-4-6' });

    // Budget guard is invoked after the tool call
    const code = await budgetGuardMain();
    assert.equal(code, 2, 'budget-guard should exit 2 when over kill threshold');

    // Sentinel + wave_end written
    assert.ok(existsSync(join(root, '.orchestre', 'state', 'BUDGET_KILLED')));
    const snap = snapshot(root);
    assert.equal(snap.byWave[3].stop_reason, 'budget_exceeded');

    // Full history intact for resume
    const events = read(root);
    assert.ok(events.length >= 10);
    assert.ok(events.some(e => e.type === 'wave_end' && e.data.stop_reason === 'budget_exceeded'));
    // Earlier waves still marked completed (not reset)
    assert.equal(snap.byWave[0].stop_reason, 'completed');
  });
});

describe('pipeline e2e — permission gates per wave', () => {
  it('decide() matches the expected enforcement matrix across waves', () => {
    // Wave 0: Read yes, Write no
    assert.equal(decide({ context: DEFAULT_CONTEXTS['0'], toolName: 'Read' }).allowed, true);
    assert.equal(decide({ context: DEFAULT_CONTEXTS['0'], toolName: 'Write', filePath: 'x.ts' }).allowed, false);

    // Wave 1/2: Write to .orchestre/ yes, write to app/ no
    for (const w of ['1', '2']) {
      const ctx = DEFAULT_CONTEXTS[w];
      assert.equal(decide({ context: ctx, toolName: 'Write', filePath: '.orchestre/plan.json' }).allowed, true);
      assert.equal(decide({ context: ctx, toolName: 'Write', filePath: 'app/page.tsx' }).allowed, false);
      assert.equal(decide({ context: ctx, toolName: 'Bash' }).allowed, false);
    }

    // Wave 3: anything
    assert.equal(decide({ context: DEFAULT_CONTEXTS['3'], toolName: 'Write', filePath: 'app/page.tsx' }).allowed, true);
    assert.equal(decide({ context: DEFAULT_CONTEXTS['3'], toolName: 'Bash' }).allowed, true);

    // Wave 4: Read/Write.orchestre yes, Edit always no
    assert.equal(decide({ context: DEFAULT_CONTEXTS['4'], toolName: 'Edit', filePath: '.orchestre/x.md' }).allowed, false);
    assert.equal(decide({ context: DEFAULT_CONTEXTS['4'], toolName: 'Write', filePath: '.orchestre/x.md' }).allowed, true);
  });

  it('permission-guard blocks invalid ops and persists denials across a run', async () => {
    // Wave 0 — attempt to Write
    startWave(0);
    process.env.ORCHESTRE_WAVE = '0';
    process.env.TOOL_INPUT = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'app/x.ts', content: 'y' } });
    assert.equal(await permGuardMain(), 2);

    // Wave 3 — same Write now allowed
    startWave(3);
    process.env.ORCHESTRE_WAVE = '3';
    assert.equal(await permGuardMain(), 0);

    const denials = read(root, { type: 'permission_denial' });
    assert.equal(denials.length, 1);
    assert.equal(denials[0].wave, 0);
    assert.equal(denials[0].data.tool_name, 'Write');
  });
});

describe('pipeline e2e — turn-loop enforcement', () => {
  it('raises MaxTurnsExceededError when Wave 0 exhausts its 3-turn budget', () => {
    startWave(0);
    for (let i = 0; i < 3; i++) simulateTurn({ wave: 0, tokens_in: 100, tokens_out: 50 });
    assert.throws(
      () => assertTurnBudget(root, 0),
      (err) => err instanceof MaxTurnsExceededError && err.wave === 0,
    );
  });

  it('assertTurnBudget passes comfortably in the middle of a normal wave', () => {
    startWave(3);
    simulateTurn({ wave: 3, tokens_in: 5000, tokens_out: 2000 });
    const r = assertTurnBudget(root, 3);
    assert.ok(r.turnsUsed === 1);
    assert.ok(r.limits.max_turns >= 12);
  });

  it('tokens accumulated per wave from turn events match totalSoFar', () => {
    startWave(1);
    simulateTurn({ wave: 1, tokens_in: 4000, tokens_out: 2000, model: 'claude-opus-4-6' });
    simulateTurn({ wave: 1, tokens_in: 3000, tokens_out: 1500, model: 'claude-opus-4-6' });

    const st = turnState(root, 1);
    assert.equal(st.turnsUsed, 2);
    assert.equal(st.tokensUsed, 10500);

    const t = totalSoFar(root);
    assert.equal(t.tokens_in, 7000);
    assert.equal(t.tokens_out, 3500);
  });
});

describe('pipeline e2e — composability: budget warn does not block', () => {
  it('evaluateBudget returns warn (not kill) between thresholds', () => {
    // $10 budget, warn 75% ($7.50), kill 120% ($12)
    startWave(3);
    simulateTurn({ wave: 3, tokens_in: 400_000, tokens_out: 80_000, model: 'claude-opus-4-6' }); // $12.0 - right at kill
    // Step back to $8 so we are in the warn zone
    rmSync(join(root, '.orchestre', 'state', 'events.jsonl'));
    rmSync(join(root, '.orchestre', 'state', 'snapshot.json'));
    init(root);
    simulateTurn({ wave: 3, tokens_in: 300_000, tokens_out: 50_000, model: 'claude-opus-4-6' }); // $8.25

    const r = evaluateBudget(root, { max_usd: 10, kill_threshold_pct: 120, warn_threshold_pct: 75 });
    assert.equal(r.status, 'warn');
  });
});

describe('pipeline e2e — events.jsonl is the source of truth', () => {
  it('snapshot reconstructed from scratch equals snapshot built incrementally', () => {
    startWave(0); simulateTurn({ wave: 0, tokens_in: 1000, tokens_out: 500 }); endWave(0);
    startWave(1); simulateTurn({ wave: 1, tokens_in: 5000, tokens_out: 2000, model: 'claude-opus-4-6' });

    const incrementalSnap = snapshot(root);
    const rebuilt = rebuildSnapshot(root);

    assert.deepEqual(incrementalSnap.byWave, rebuilt.byWave);
    assert.deepEqual(incrementalSnap.costSoFar, rebuilt.costSoFar);
    assert.equal(incrementalSnap.turnCount, rebuilt.turnCount);
  });

  it('events.jsonl is strictly append-only throughout a full run', () => {
    const eventsPath = join(root, '.orchestre', 'state', 'events.jsonl');
    const snapshots = [];
    for (let w = 0; w <= 4; w++) {
      startWave(w);
      simulateTurn({ wave: w, tokens_in: 500, tokens_out: 200 });
      endWave(w);
      snapshots.push(readFileSync(eventsPath, 'utf8'));
    }
    // Each snapshot must be a strict prefix of the next
    for (let i = 1; i < snapshots.length; i++) {
      assert.ok(snapshots[i].startsWith(snapshots[i - 1]),
        `events.jsonl was mutated between wave ${i - 1} and ${i}`);
    }
  });
});
