import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { init, read } from '../../core/runtime/state-store.mjs';
import {
  DEFAULT_TIMEOUT_SECONDS, evaluate, isNonInteractive,
  parseResponse, renderPrompt, summarizePlan,
} from '../../core/runtime/plan-gate.mjs';

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'orchestre-plangate-')); init(root); });
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env.ORCHESTRE_NO_GATE;
  delete process.env.CI;
});

const SAMPLE_PLAN = {
  version: '2.0.0',
  project_id: 'hello-saas',
  tasks: [
    { task_id: 'T001', feature_id: 'F01', parallel_group: 1, order: 1 },
    { task_id: 'T002', feature_id: 'F01', parallel_group: 1, order: 2 },
    { task_id: 'T003', feature_id: 'F02', parallel_group: 2, order: 3 },
  ],
  cost_estimate: { total_usd: 1.42, per_feature: { F01: 0.90, F02: 0.52 }, profile: 'balanced' },
  council_checks: { warnings: [{ msg: 'check auth flow' }] },
};

describe('plan-gate — summarizePlan', () => {
  it('aggregates counts correctly on a well-formed plan', () => {
    const s = summarizePlan(SAMPLE_PLAN);
    assert.equal(s.valid, true);
    assert.equal(s.tasks, 3);
    assert.equal(s.features, 2);
    assert.equal(s.parallel_groups, 2);
    assert.equal(s.cost_total_usd, 1.42);
    assert.equal(s.council_warnings, 1);
    assert.equal(s.profile, 'balanced');
  });

  it('flags invalid plans', () => {
    assert.equal(summarizePlan(null).valid, false);
    assert.equal(summarizePlan(42).valid, false);
  });

  it('handles missing optional sections with zero defaults', () => {
    const s = summarizePlan({ tasks: [] });
    assert.equal(s.tasks, 0);
    assert.equal(s.features, 0);
    assert.equal(s.parallel_groups, 0);
    assert.equal(s.cost_total_usd, 0);
    assert.equal(s.council_warnings, 0);
  });
});

describe('plan-gate — renderPrompt', () => {
  it('renders the 4 bullets with task/feature/parallel/cost breakdown', () => {
    const s = summarizePlan(SAMPLE_PLAN);
    const p = renderPrompt(s);
    assert.match(p, /3 tasks across 2 features/);
    assert.match(p, /2 parallel groups/);
    assert.match(p, /Projected cost: \$1\.42/);
    assert.match(p, /1 council warning flagged/);
    assert.match(p, /\[ENTER \/ Y \/ go\]/);
    assert.match(p, /\[R \/ replan\]/);
    assert.match(p, /\[X \/ abort\]/);
  });

  it('renders a clear error when plan is invalid', () => {
    const s = summarizePlan(null);
    const p = renderPrompt(s);
    assert.match(p, /invalid or missing/);
  });
});

describe('plan-gate — parseResponse', () => {
  it('ENTER / empty / y / ok → go', () => {
    for (const a of ['', '  ', 'y', 'Yes', 'OK', 'go', 'GO', 'proceed']) {
      assert.equal(parseResponse(a), 'go', `answer "${a}" should be go`);
    }
  });

  it('r / replan → replan', () => {
    assert.equal(parseResponse('r'), 'replan');
    assert.equal(parseResponse('REPLAN'), 'replan');
  });

  it('x / abort / no → abort', () => {
    for (const a of ['x', 'abort', 'stop', 'cancel', 'quit', 'n', 'no']) {
      assert.equal(parseResponse(a), 'abort', `answer "${a}" should be abort`);
    }
  });

  it('null / undefined → default decision', () => {
    assert.equal(parseResponse(undefined), 'go');
    assert.equal(parseResponse(null, { defaultDecision: 'abort' }), 'abort');
  });

  it('unknown answer → default decision', () => {
    assert.equal(parseResponse('maybe?'), 'go');
    assert.equal(parseResponse('maybe?', { defaultDecision: 'replan' }), 'replan');
  });
});

describe('plan-gate — isNonInteractive', () => {
  it('ORCHESTRE_NO_GATE=1 → non-interactive', () => {
    process.env.ORCHESTRE_NO_GATE = '1';
    assert.equal(isNonInteractive(), true);
  });

  it('CI truthy → non-interactive', () => {
    process.env.CI = 'true';
    assert.equal(isNonInteractive(), true);
  });
});

describe('plan-gate — evaluate', () => {
  it('returns decision=go + persists plan_gate_decision event when user proceeds', () => {
    const r = evaluate(root, SAMPLE_PLAN, { answer: 'y', nonInteractive: false });
    assert.equal(r.decision, 'go');
    const events = read(root, { type: 'plan_gate_decision' });
    assert.equal(events.length, 1);
    assert.equal(events[0].data.decision, 'go');
    assert.equal(events[0].wave, 2);
  });

  it('returns decision=replan when user answers r', () => {
    const r = evaluate(root, SAMPLE_PLAN, { answer: 'r', nonInteractive: false });
    assert.equal(r.decision, 'replan');
  });

  it('returns decision=abort when user answers x', () => {
    const r = evaluate(root, SAMPLE_PLAN, { answer: 'abort', nonInteractive: false });
    assert.equal(r.decision, 'abort');
  });

  it('non-interactive: returns default decision (go) regardless of answer', () => {
    const r = evaluate(root, SAMPLE_PLAN, { answer: 'abort', nonInteractive: true });
    assert.equal(r.decision, 'go');
    assert.equal(r.nonInteractive, true);
  });

  it('invalid plan → decision=abort with reason logged', () => {
    const r = evaluate(root, null, { answer: 'y' });
    assert.equal(r.decision, 'abort');
    const events = read(root, { type: 'plan_gate_decision' });
    assert.ok(events[0].data.reason);
  });

  it('default timeout is 60s (documented constant)', () => {
    assert.equal(DEFAULT_TIMEOUT_SECONDS, 60);
  });
});
