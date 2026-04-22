import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { init, snapshot, read } from '../../core/runtime/state-store.mjs';
import { record } from '../../core/runtime/cost-tracker.mjs';
import { evaluate, main as guardMain } from '../../core/hooks/budget-guard.mjs';

let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orchestre-budget-'));
  init(root);
  process.env.ORCHESTRE_PROJECT_ROOT = root;
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env.ORCHESTRE_PROJECT_ROOT;
});

function writeBudget(cfg) {
  mkdirSync(join(root, '.orchestre'), { recursive: true });
  writeFileSync(join(root, '.orchestre', 'budget.json'), JSON.stringify(cfg));
}

describe('budget-guard — evaluate()', () => {
  it('returns ok when spent under warn threshold', () => {
    record(root, { wave: 0, model: 'claude-sonnet-4-6', tokens_in: 10_000, tokens_out: 5_000 });
    const r = evaluate(root, { max_usd: 10, kill_threshold_pct: 120, warn_threshold_pct: 75 });
    assert.equal(r.status, 'ok');
  });

  it('returns warn when spent > warn threshold, < kill', () => {
    record(root, { wave: 1, model: 'claude-opus-4-6', tokens_in: 600_000, tokens_out: 100_000 }); // $16.5
    const r = evaluate(root, { max_usd: 20, kill_threshold_pct: 120, warn_threshold_pct: 75 });
    assert.equal(r.status, 'warn');
  });

  it('returns kill when spent > kill threshold', () => {
    record(root, { wave: 1, model: 'claude-opus-4-6', tokens_in: 1_000_000, tokens_out: 1_000_000 }); // $90
    const r = evaluate(root, { max_usd: 50, kill_threshold_pct: 120 });
    assert.equal(r.status, 'kill');
    assert.equal(r.killLimit, 60);
  });
});

describe('budget-guard — main() as PostToolUse hook', () => {
  it('exits 0 when no .orchestre/state exists (no-op)', async () => {
    const blank = mkdtempSync(join(tmpdir(), 'orchestre-blank-'));
    process.env.ORCHESTRE_PROJECT_ROOT = blank;
    const code = await guardMain();
    assert.equal(code, 0);
    rmSync(blank, { recursive: true, force: true });
  });

  it('exits 0 when no budget.json exists (opt-in only)', async () => {
    record(root, { wave: 0, model: 'claude-opus-4-6', tokens_in: 1_000_000, tokens_out: 1_000_000 }); // $90
    const code = await guardMain();
    assert.equal(code, 0);
  });

  it('exits 2 and writes wave_end + BUDGET_KILLED sentinel when over kill limit', async () => {
    writeBudget({ max_usd: 5, kill_threshold_pct: 120, warn_threshold_pct: 75 });
    record(root, { wave: 2, model: 'claude-opus-4-6', tokens_in: 500_000, tokens_out: 200_000 }); // $22.5
    const code = await guardMain();
    assert.equal(code, 2);

    const killed = existsSync(join(root, '.orchestre', 'state', 'BUDGET_KILLED'));
    assert.ok(killed, 'BUDGET_KILLED sentinel should be written');
    const sentinel = JSON.parse(readFileSync(join(root, '.orchestre', 'state', 'BUDGET_KILLED'), 'utf8'));
    assert.equal(sentinel.wave, 2);

    const waveEnds = read(root, { type: 'wave_end' });
    assert.equal(waveEnds.length, 1);
    assert.equal(waveEnds[0].data.stop_reason, 'budget_exceeded');
    assert.equal(snapshot(root).byWave[2].stop_reason, 'budget_exceeded');
  });

  it('exits 0 with warning when between warn and kill (no sentinel)', async () => {
    writeBudget({ max_usd: 10, kill_threshold_pct: 120, warn_threshold_pct: 75 });
    record(root, { wave: 1, model: 'claude-sonnet-4-6', tokens_in: 800_000, tokens_out: 200_000 }); // $5.4 (54%)
    // force warn: record more to get over 75% of $10 ($7.5)
    record(root, { wave: 1, model: 'claude-sonnet-4-6', tokens_in: 500_000, tokens_out: 100_000 }); // +$3 → $8.4
    const code = await guardMain();
    assert.equal(code, 0);
    assert.ok(!existsSync(join(root, '.orchestre', 'state', 'BUDGET_KILLED')));
  });

  it('resume-ready: state preserved after kill (events.jsonl + snapshot intact)', async () => {
    writeBudget({ max_usd: 5, kill_threshold_pct: 120 });
    record(root, { wave: 3, model: 'claude-opus-4-6', tokens_in: 1_000_000, tokens_out: 100_000 }); // $22.5
    await guardMain();
    const events = read(root);
    assert.ok(events.length >= 2, 'cost + wave_end events both persisted');
    const snap = snapshot(root);
    assert.ok(snap.costSoFar.usd > 20, 'cost preserved in snapshot');
    assert.equal(snap.byWave[3].stop_reason, 'budget_exceeded');
  });
});
