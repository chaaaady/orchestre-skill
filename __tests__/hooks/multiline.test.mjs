import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8');

let typescriptAstChecker;
try {
  const mod = await import('../../stacks/nextjs-supabase/hooks/typescript-ast.mjs');
  typescriptAstChecker = mod.typescriptAstChecker;
} catch {
  typescriptAstChecker = null;
}

describe('typescriptAstChecker — multi-line patterns', () => {
  it('blocks multi-line supabase.from() in app/ files (TS-03)', async () => {
    if (!typescriptAstChecker) return;
    const code = fixture('code-multiline-supabase.ts');
    const result = await typescriptAstChecker.check('app/page.tsx', code);
    if (result.message && result.message.includes('not available')) return;
    assert.equal(result.status, 'blocked');
    assert.ok(result.violations.some(v => v.rule === 'TS-03'),
      `Expected TS-03 for multi-line supabase.from() in app/, got: ${JSON.stringify(result.violations)}`);
  });

  it('passes multi-line supabase.from() in lib/ files', async () => {
    if (!typescriptAstChecker) return;
    const code = fixture('code-multiline-supabase.ts');
    const result = await typescriptAstChecker.check('lib/queries/users.ts', code);
    if (result.message && result.message.includes('not available')) return;
    const ts03 = result.violations.filter(v => v.rule === 'TS-03');
    assert.equal(ts03.length, 0,
      `Expected no TS-03 in lib/, got: ${JSON.stringify(ts03)}`);
  });

  it('blocks multi-line supabase.from() in components/ files (TS-03)', async () => {
    if (!typescriptAstChecker) return;
    const code = fixture('code-multiline-supabase.ts');
    const result = await typescriptAstChecker.check('components/dashboard/UserList.tsx', code);
    if (result.message && result.message.includes('not available')) return;
    assert.equal(result.status, 'blocked');
    assert.ok(result.violations.some(v => v.rule === 'TS-03'));
  });

  it('blocks bare fetch() in app/ files (TS-03)', async () => {
    if (!typescriptAstChecker) return;
    const code = `const data = await fetch('/api/users');\n`;
    const result = await typescriptAstChecker.check('app/dashboard/page.tsx', code);
    if (result.message && result.message.includes('not available')) return;
    assert.equal(result.status, 'blocked');
    assert.ok(result.violations.some(v => v.rule === 'TS-03'));
  });

  it('passes fetch() in lib/ files', async () => {
    if (!typescriptAstChecker) return;
    const code = `const data = await fetch('/api/users');\n`;
    const result = await typescriptAstChecker.check('lib/queries/users.ts', code);
    if (result.message && result.message.includes('not available')) return;
    const ts03 = result.violations.filter(v => v.rule === 'TS-03');
    assert.equal(ts03.length, 0);
  });
});
