import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { init, read } from '../../core/runtime/state-store.mjs';
import {
  ContractViolationError, assertContract, availableContracts,
  clearCache, validateContract,
} from '../../core/runtime/contract-guard.mjs';

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'orchestre-contract-')); init(root); clearCache(); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const VALID_BRIEF_LINT = {
  project_name: 'test-saas',
  project_weight: 'M',
  features: [{ name: 'auth', description: 'Sign in/up' }],
  lint_results: {
    fatal_count: 0, warning_count: 1, info_count: 0,
    checks: [
      { id: 'L01', severity: 'INFO', passed: true, message: 'project_name present' },
      { id: 'L02', severity: 'WARNING', passed: false, message: 'description short' },
    ],
  },
};

describe('contract-guard — availability', () => {
  it('lists all schemas from core/contracts/schemas', () => {
    const list = availableContracts();
    assert.ok(list.includes('BriefLint'));
    assert.ok(list.includes('IntentV2'));
    assert.ok(list.includes('PlanV2'));
    assert.ok(list.includes('StateV2'));
  });
});

describe('contract-guard — validateContract', () => {
  it('returns valid=true for a well-formed BriefLint', () => {
    const r = validateContract('BriefLint', VALID_BRIEF_LINT);
    assert.equal(r.valid, true);
    assert.equal(r.errors.length, 0);
  });

  it('returns valid=false with descriptive errors for missing required field', () => {
    const bad = { ...VALID_BRIEF_LINT };
    delete bad.project_name;
    const r = validateContract('BriefLint', bad);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => /project_name/.test(e.path) || /project_name/.test(e.message)));
  });

  it('returns valid=false for pattern violation (L01..L99 on check id)', () => {
    const bad = structuredClone(VALID_BRIEF_LINT);
    bad.lint_results.checks[0].id = 'NOT_VALID_ID';
    const r = validateContract('BriefLint', bad);
    assert.equal(r.valid, false);
  });

  it('unknown contract returns unknown=true without throwing (permissive for optional contracts)', () => {
    const r = validateContract('DoesNotExist', { foo: 'bar' });
    assert.equal(r.valid, true);
    assert.equal(r.unknown, true);
  });
});

describe('contract-guard — assertContract', () => {
  it('no-op on valid data', () => {
    const r = assertContract(root, 'BriefLint', VALID_BRIEF_LINT, { wave: 0, label: 'wave-0-lint' });
    assert.equal(r.valid, true);
    assert.equal(read(root, { type: 'contract_violation' }).length, 0);
  });

  it('throws ContractViolationError on invalid data and persists event', () => {
    const bad = structuredClone(VALID_BRIEF_LINT);
    bad.lint_results.fatal_count = -1; // minimum: 0

    assert.throws(
      () => assertContract(root, 'BriefLint', bad, { wave: 0, label: 'wave-0-lint' }),
      (err) => err instanceof ContractViolationError
        && err.contractName === 'BriefLint'
        && err.wave === 0
        && err.errors.length > 0,
    );

    const violations = read(root, { type: 'contract_violation' });
    assert.equal(violations.length, 1);
    assert.equal(violations[0].wave, 0);
    assert.equal(violations[0].data.contract, 'BriefLint');
    assert.ok(violations[0].data.first_error);
  });

  it('throws on unknown contract name (fail-fast for explicit asserts)', () => {
    assert.throws(
      () => assertContract(root, 'NopeNope', { any: 1 }, { wave: 1 }),
      (err) => err instanceof ContractViolationError && /Unknown contract/.test(err.errors[0].message),
    );
  });

  it('Error summary contains up to 3 first-error lines', () => {
    const bad = { foo: 'bar' }; // missing lots of required fields
    try {
      assertContract(root, 'BriefLint', bad, { wave: 0 });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof ContractViolationError);
      assert.ok(err.message.includes('Contract "BriefLint" failed'));
      assert.ok(err.errors.length >= 1);
    }
  });
});
