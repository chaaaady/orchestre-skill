import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { init } from '../../core/runtime/state-store.mjs';
import {
  DEFAULT_LIMITS, MaxTokensExceededError, MaxTurnsExceededError,
  assertTurnBudget, compactNeeded, getLimits, loadLimits, recordTurn, state,
} from '../../core/runtime/turn-loop.mjs';

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'orchestre-turn-')); init(root); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe('turn-loop — defaults from query-engine.md', () => {
  it('wave 0 defaults: 3 turns / 15k tokens / compact@5', () => {
    assert.deepEqual(DEFAULT_LIMITS['0'], { max_turns: 3, max_budget_tokens: 15000, compact_after: 5 });
  });

  it('wave 3-init is stricter than wave 3 per-feature', () => {
    assert.ok(DEFAULT_LIMITS['3-init'].max_turns > DEFAULT_LIMITS['3'].max_turns);
    assert.ok(DEFAULT_LIMITS['3-init'].max_budget_tokens > DEFAULT_LIMITS['3'].max_budget_tokens);
  });

  it('getLimits() returns null for unknown wave', () => {
    assert.equal(getLimits(99), null);
  });
});

describe('turn-loop — loadLimits() override', () => {
  it('returns DEFAULT_LIMITS when no config file', () => {
    const lim = loadLimits(root);
    assert.deepEqual(lim['0'], DEFAULT_LIMITS['0']);
  });

  it('merges partial overrides with defaults per-wave', () => {
    mkdirSync(join(root, '.orchestre'), { recursive: true });
    writeFileSync(join(root, '.orchestre', 'turn-limits.json'),
      JSON.stringify({ '1': { max_turns: 20 } }));
    const lim = loadLimits(root);
    assert.equal(lim['1'].max_turns, 20);
    assert.equal(lim['1'].max_budget_tokens, DEFAULT_LIMITS['1'].max_budget_tokens);
    assert.deepEqual(lim['0'], DEFAULT_LIMITS['0']);
  });

  it('falls back to defaults when config is invalid JSON', () => {
    mkdirSync(join(root, '.orchestre'), { recursive: true });
    writeFileSync(join(root, '.orchestre', 'turn-limits.json'), '{ corrupt');
    const lim = loadLimits(root);
    assert.deepEqual(lim, { ...DEFAULT_LIMITS });
  });
});

describe('turn-loop — recordTurn + state', () => {
  it('recordTurn accumulates turns and tokens into snapshot.byWave', () => {
    recordTurn(root, { wave: 1, tokens_in: 2000, tokens_out: 1000 });
    recordTurn(root, { wave: 1, tokens_in: 500,  tokens_out: 300 });
    const s = state(root, 1);
    assert.equal(s.turnsUsed, 2);
    assert.equal(s.tokensUsed, 3800);
  });

  it('throws if wave missing', () => {
    assert.throws(() => recordTurn(root, { tokens_in: 1 }), /wave is required/);
  });

  it('state() returns 0/0 for wave with no events', () => {
    const s = state(root, 4);
    assert.equal(s.turnsUsed, 0);
    assert.equal(s.tokensUsed, 0);
  });
});

describe('turn-loop — assertTurnBudget', () => {
  it('passes when under both limits', () => {
    recordTurn(root, { wave: 0, tokens_in: 1000, tokens_out: 500 });
    const r = assertTurnBudget(root, 0);
    assert.equal(r.turnsUsed, 1);
    assert.ok(r.tokensUsed === 1500);
  });

  it('throws MaxTurnsExceededError when turns hit limit', () => {
    // wave 0 default = max_turns 3
    for (let i = 0; i < 3; i++) recordTurn(root, { wave: 0, tokens_in: 100 });
    assert.throws(
      () => assertTurnBudget(root, 0),
      (err) => err instanceof MaxTurnsExceededError && err.limit === 3 && err.turnsUsed === 3,
    );
  });

  it('throws MaxTokensExceededError when tokens hit limit', () => {
    // wave 0 default = 15000 tokens
    recordTurn(root, { wave: 0, tokens_in: 10000, tokens_out: 5000 });
    assert.throws(
      () => assertTurnBudget(root, 0),
      (err) => err instanceof MaxTokensExceededError && err.limit === 15000,
    );
  });

  it('noop (no throw) on unknown wave — limits null', () => {
    const r = assertTurnBudget(root, 99);
    assert.equal(r.limits, null);
  });
});

describe('turn-loop — compactNeeded', () => {
  it('false under compact_after, true once reached', () => {
    // wave 2 default = compact_after 10
    for (let i = 0; i < 9; i++) recordTurn(root, { wave: 2 });
    assert.equal(compactNeeded(root, 2), false);
    recordTurn(root, { wave: 2 });
    assert.equal(compactNeeded(root, 2), true);
  });

  it('false for unknown wave', () => {
    assert.equal(compactNeeded(root, 42), false);
  });
});
