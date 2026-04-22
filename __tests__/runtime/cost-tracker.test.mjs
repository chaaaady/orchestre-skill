import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { init } from '../../core/runtime/state-store.mjs';
import {
  BudgetExceededError, estimateCost, guardBudget, priceOf,
  projectedCostBeforeExecute, record, remaining, totalSoFar,
} from '../../core/runtime/cost-tracker.mjs';

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'orchestre-cost-')); init(root); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe('cost-tracker — pricing', () => {
  it('returns null price for unknown model', () => {
    assert.equal(priceOf('gpt-5'), null);
  });

  it('estimates opus-4-6 cost: 1M in + 1M out = $15 + $75', () => {
    const usd = estimateCost({ model: 'claude-opus-4-6', tokens_in: 1_000_000, tokens_out: 1_000_000 });
    assert.equal(usd, 90);
  });

  it('estimates sonnet cost at 5x less than opus on input', () => {
    const opus = estimateCost({ model: 'claude-opus-4-6', tokens_in: 1_000_000, tokens_out: 0 });
    const sonnet = estimateCost({ model: 'claude-sonnet-4-6', tokens_in: 1_000_000, tokens_out: 0 });
    assert.equal(opus / sonnet, 5);
  });

  it('returns 0 for unknown model (degrades gracefully)', () => {
    assert.equal(estimateCost({ model: 'mystery', tokens_in: 1000, tokens_out: 500 }), 0);
  });
});

describe('cost-tracker — record + totals', () => {
  it('accumulates cost across records from multiple waves', () => {
    record(root, { wave: 0, model: 'claude-sonnet-4-6', tokens_in: 10_000, tokens_out: 5_000 });
    record(root, { wave: 1, model: 'claude-opus-4-6', tokens_in: 5_000, tokens_out: 2_000 });
    const t = totalSoFar(root);
    assert.ok(t.usd > 0);
    assert.equal(t.tokens_in, 15_000);
    assert.equal(t.tokens_out, 7_000);
  });

  it('record throws if wave is missing', () => {
    assert.throws(() => record(root, { model: 'claude-opus-4-6', tokens_in: 1 }), /wave is required/);
  });

  it('remaining() is budget minus spent, clamped at 0', () => {
    record(root, { wave: 0, model: 'claude-opus-4-6', tokens_in: 100_000, tokens_out: 50_000 }); // $5.25
    assert.equal(remaining(root, 10).toFixed(2), '4.75');
    assert.equal(remaining(root, 1), 0);
  });
});

describe('cost-tracker — projection + budget guard', () => {
  it('projectedCostBeforeExecute sums spent + projected, flags wouldExceed', () => {
    record(root, { wave: 0, model: 'claude-sonnet-4-6', tokens_in: 100_000, tokens_out: 50_000 }); // $1.05
    const p = projectedCostBeforeExecute(root,
      { model: 'claude-opus-4-6', tokens_in: 100_000, tokens_out: 50_000, wave: 1 }, // $5.25
      5);
    assert.ok(p.spent > 1 && p.spent < 1.1);
    assert.ok(p.projected > 5.2 && p.projected < 5.3);
    assert.equal(p.wouldExceed, true);
  });

  it('wouldExceed is false when the sum fits under budget', () => {
    const p = projectedCostBeforeExecute(root,
      { model: 'claude-haiku-4-5', tokens_in: 10_000, tokens_out: 5_000, wave: 0 },
      10);
    assert.equal(p.wouldExceed, false);
  });

  it('guardBudget throws BudgetExceededError when spent > budget', () => {
    record(root, { wave: 1, model: 'claude-opus-4-6', tokens_in: 1_000_000, tokens_out: 1_000_000 }); // $90
    assert.throws(
      () => guardBudget(root, 50, { wave: 1, label: 'wave-1-decompose' }),
      (err) => err instanceof BudgetExceededError && err.wave === 1 && err.label === 'wave-1-decompose'
    );
  });

  it('guardBudget returns remaining when under budget', () => {
    record(root, { wave: 0, model: 'claude-sonnet-4-6', tokens_in: 100_000, tokens_out: 50_000 });
    const r = guardBudget(root, 10, { wave: 0 });
    assert.ok(r.remaining > 8.9);
    assert.ok(r.spent > 1);
  });
});
