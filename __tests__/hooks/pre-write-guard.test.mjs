import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { secretsChecker } from '../../core/hooks/lib/checkers/secrets.mjs';
import { tailwindTokensChecker } from '../../stacks/nextjs-supabase/hooks/tailwind-tokens.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8');

describe('secretsChecker', () => {
  it('blocks files with Stripe secret keys', async () => {
    const result = await secretsChecker.check('app/config.ts', fixture('code-with-secrets.ts'));
    assert.equal(result.status, 'blocked');
    assert.ok(result.violations.some(v => v.rule === 'SECRET-01'));
  });

  it('blocks files with JWT tokens', async () => {
    const result = await secretsChecker.check('lib/auth.ts', fixture('code-with-secrets.ts'));
    assert.ok(result.violations.some(v => v.rule === 'SECRET-02'));
  });

  it('blocks files with GitHub PATs', async () => {
    const result = await secretsChecker.check('lib/gh.ts', fixture('code-with-secrets.ts'));
    assert.ok(result.violations.some(v => v.rule === 'SECRET-03'));
  });

  it('passes clean files', async () => {
    const result = await secretsChecker.check('lib/utils.ts', fixture('code-clean.ts'));
    assert.equal(result.status, 'passed');
    assert.equal(result.violations.length, 0);
  });
});

describe('tailwindTokensChecker', () => {
  it('blocks hardcoded Tailwind colors', async () => {
    const result = await tailwindTokensChecker.check('components/card.tsx', fixture('code-hardcoded-colors.tsx'));
    assert.equal(result.status, 'blocked');
    assert.ok(result.violations.length >= 3);
    assert.ok(result.violations.every(v => v.rule === 'DESIGN-01'));
  });

  it('passes semantic tokens', async () => {
    const result = await tailwindTokensChecker.check('components/page.tsx', fixture('code-clean.ts'));
    assert.equal(result.status, 'passed');
  });
});
