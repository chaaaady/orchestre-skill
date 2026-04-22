import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { init, read } from '../../core/runtime/state-store.mjs';
import {
  DEFAULT_THRESHOLDS, MutationScoreBelowThresholdError,
  assertMutationScore, classifyPath, parseStrykerReport, summary,
} from '../../core/runtime/mutation-score.mjs';

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'orchestre-mut-')); init(root); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

// Minimal stryker report fixture — mirrors the real shape.
function buildReport({ auth, standard, experimental }) {
  const make = (path, mutants) => [path, { mutants }];
  const m = (status) => ({ status });
  return {
    mutationScore: 72.5,
    mutationScoreBasedOnCoveredCode: 80.0,
    files: Object.fromEntries([
      make('lib/auth/login.ts', [
        ...Array(Math.round(auth * 10)).fill(m('Killed')),
        ...Array(10 - Math.round(auth * 10)).fill(m('Survived')),
      ]),
      make('lib/utils.ts', [
        ...Array(Math.round(standard * 10)).fill(m('Killed')),
        ...Array(10 - Math.round(standard * 10)).fill(m('Survived')),
      ]),
      make('app/experimental.draft.ts', [
        ...Array(Math.round(experimental * 10)).fill(m('Killed')),
        ...Array(10 - Math.round(experimental * 10)).fill(m('Survived')),
      ]),
    ]),
  };
}

describe('mutation-score — classifyPath', () => {
  it('auth/billing/webhook/crypto/rls paths → critical', () => {
    for (const p of ['lib/auth/login.ts', 'app/billing/checkout.ts', 'app/webhook/stripe.ts',
                     'lib/crypto/sign.ts', 'lib/rls/policies.ts', 'lib/admin/users.ts']) {
      assert.equal(classifyPath(p), 'critical', `${p} should be critical`);
    }
  });

  it('.draft / .experimental / .sandbox → experimental', () => {
    assert.equal(classifyPath('src/x.draft.ts'), 'experimental');
    assert.equal(classifyPath('app/feat.experimental.ts'), 'experimental');
  });

  it('other paths → standard', () => {
    assert.equal(classifyPath('lib/utils.ts'), 'standard');
    assert.equal(classifyPath(''), 'standard');
    assert.equal(classifyPath(null), 'standard');
  });
});

describe('mutation-score — parseStrykerReport', () => {
  it('returns valid=false for non-object input', () => {
    assert.equal(parseStrykerReport(null).valid, false);
  });

  it('parses counts and per-file score from fixture', () => {
    const raw = buildReport({ auth: 0.9, standard: 0.6, experimental: 0.4 });
    const r = parseStrykerReport(raw);
    assert.equal(r.valid, true);
    assert.equal(r.mutationScore, 72.5);
    assert.equal(r.totals.killed + r.totals.survived, 30);
    assert.ok(r.files['lib/auth/login.ts'].mutationScore >= 89);
    assert.equal(r.files['lib/auth/login.ts'].category, 'critical');
    assert.equal(r.files['lib/utils.ts'].category, 'standard');
    assert.equal(r.files['app/experimental.draft.ts'].category, 'experimental');
  });

  it('accepts a JSON string', () => {
    const raw = JSON.stringify(buildReport({ auth: 0.8, standard: 0.5, experimental: 0.3 }));
    const r = parseStrykerReport(raw);
    assert.equal(r.valid, true);
  });
});

describe('mutation-score — assertMutationScore', () => {
  it('passes when every file clears its category threshold', () => {
    const r = parseStrykerReport(buildReport({ auth: 0.8, standard: 0.6, experimental: 0.4 }));
    const result = assertMutationScore(r, { projectRoot: root, wave: 4, label: 'final-audit' });
    assert.equal(result.passed, true);
    const events = read(root, { type: 'mutation_score_pass' });
    assert.equal(events.length, 1);
  });

  it('throws when a critical file is below 70%', () => {
    const r = parseStrykerReport(buildReport({ auth: 0.5, standard: 0.8, experimental: 0.8 }));
    assert.throws(
      () => assertMutationScore(r, { projectRoot: root, wave: 4 }),
      (err) => err instanceof MutationScoreBelowThresholdError
        && err.category === 'critical'
        && err.threshold === 70,
    );
    const events = read(root, { type: 'mutation_score_fail' });
    assert.equal(events.length, 1);
    assert.equal(events[0].data.failures[0].category, 'critical');
  });

  it('tolerates a standard file at 50% (edge)', () => {
    const r = parseStrykerReport(buildReport({ auth: 0.8, standard: 0.5, experimental: 0.3 }));
    const result = assertMutationScore(r, { projectRoot: root });
    assert.equal(result.passed, true);
  });

  it('throws when an experimental file drops below 30%', () => {
    const r = parseStrykerReport(buildReport({ auth: 0.8, standard: 0.6, experimental: 0.2 }));
    assert.throws(
      () => assertMutationScore(r, { projectRoot: root }),
      (err) => err instanceof MutationScoreBelowThresholdError && err.category === 'experimental',
    );
  });

  it('custom thresholds override defaults', () => {
    const r = parseStrykerReport(buildReport({ auth: 0.6, standard: 0.8, experimental: 0.8 }));
    // default critical=70 would fail. Custom critical=50 passes.
    const result = assertMutationScore(r, {
      projectRoot: root,
      thresholds: { critical: 50, standard: 50, experimental: 30 },
    });
    assert.equal(result.passed, true);
  });

  it('default thresholds are 70 / 50 / 30', () => {
    assert.deepEqual(DEFAULT_THRESHOLDS, { critical: 70, standard: 50, experimental: 30 });
  });
});

describe('mutation-score — summary', () => {
  it('produces a human-readable summary grouped by category', () => {
    const r = parseStrykerReport(buildReport({ auth: 0.9, standard: 0.6, experimental: 0.4 }));
    const s = summary(r);
    assert.equal(s.valid, true);
    assert.equal(s.files_checked, 3);
    assert.equal(s.mutants_total, 30);
    assert.equal(s.by_category.critical.length, 1);
    assert.equal(s.by_category.standard.length, 1);
    assert.equal(s.by_category.experimental.length, 1);
  });
});
