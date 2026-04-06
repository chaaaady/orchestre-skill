import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { secretsChecker } from '../../core/hooks/lib/checkers/secrets.mjs';

describe('secretsChecker — extended edge cases', () => {
  it('blocks console.log with password (SECRET-10)', async () => {
    const code = `const user = getUser();\nconsole.log('User password:', user.password);\n`;
    const result = await secretsChecker.check('app/debug.ts', code);
    assert.equal(result.status, 'blocked');
    assert.ok(result.violations.some(v => v.rule === 'SECRET-10'),
      `Expected SECRET-10, got: ${JSON.stringify(result.violations)}`);
  });

  it('blocks console.log with token (SECRET-10)', async () => {
    const code = `console.log('Token received:', token);\n`;
    const result = await secretsChecker.check('app/auth.ts', code);
    assert.equal(result.status, 'blocked');
    assert.ok(result.violations.some(v => v.rule === 'SECRET-10'));
  });

  it('blocks NEXT_PUBLIC_STRIPE_SECRET (SECRET-09)', async () => {
    const code = `const key = process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;\n`;
    const result = await secretsChecker.check('lib/config.ts', code);
    assert.equal(result.status, 'blocked');
    assert.ok(result.violations.some(v => v.rule === 'SECRET-09'),
      `Expected SECRET-09, got: ${JSON.stringify(result.violations)}`);
  });

  it('blocks PUBLIC_DATABASE_URL (SECRET-09 — SvelteKit variant)', async () => {
    const code = `const url = PUBLIC_DATABASE_URL;\n`;
    const result = await secretsChecker.check('src/lib/config.ts', code);
    assert.equal(result.status, 'blocked');
    assert.ok(result.violations.some(v => v.rule === 'SECRET-09'),
      `Expected SECRET-09, got: ${JSON.stringify(result.violations)}`);
  });

  it('passes NEXT_PUBLIC_SUPABASE_URL (not a secret)', async () => {
    const code = `const url = process.env.NEXT_PUBLIC_SUPABASE_URL;\n`;
    const result = await secretsChecker.check('lib/config.ts', code);
    const secret09 = result.violations.filter(v => v.rule === 'SECRET-09');
    assert.equal(secret09.length, 0,
      `Expected no SECRET-09 for SUPABASE_URL, got: ${JSON.stringify(secret09)}`);
  });

  it('blocks full JWT with 3 segments (SECRET-02)', async () => {
    const code = `const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';\n`;
    const result = await secretsChecker.check('lib/auth.ts', code);
    assert.ok(result.violations.some(v => v.rule === 'SECRET-02'),
      `Expected SECRET-02 for full JWT, got: ${JSON.stringify(result.violations)}`);
  });

  it('does NOT block short eyJ fragment alone (not a valid JWT)', async () => {
    const code = `const partial = 'eyJhbG';\n`;
    const result = await secretsChecker.check('lib/utils.ts', code);
    const jwtViolations = result.violations.filter(v => v.rule === 'SECRET-02');
    assert.equal(jwtViolations.length, 0,
      `Expected no SECRET-02 for short fragment, got: ${JSON.stringify(jwtViolations)}`);
  });

  it('passes code with sk_live in a comment', async () => {
    const code = `// Use sk_live_xxx for production\nconst x = 1;\n`;
    const result = await secretsChecker.check('lib/notes.ts', code);
    assert.equal(result.status, 'passed',
      `Expected passed for comment-only secret, got: ${JSON.stringify(result.violations)}`);
  });

  it('blocks console.info with session (SECRET-10)', async () => {
    const code = `console.info('Current session:', session);\n`;
    const result = await secretsChecker.check('app/page.ts', code);
    assert.ok(result.violations.some(v => v.rule === 'SECRET-10'));
  });

  it('passes normal console.log without sensitive data', async () => {
    const code = `console.log('Hello world');\nconsole.log('Page loaded');\n`;
    const result = await secretsChecker.check('app/page.ts', code);
    const secret10 = result.violations.filter(v => v.rule === 'SECRET-10');
    assert.equal(secret10.length, 0);
  });
});
