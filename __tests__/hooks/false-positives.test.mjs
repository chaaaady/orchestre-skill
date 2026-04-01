import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8');

describe('false positive prevention', () => {
  it('`any` in comments and strings does NOT trigger typescript-ast checker', async () => {
    // Dynamic import to handle TypeScript availability
    let typescriptAstChecker;
    try {
      const mod = await import('../../hooks/lib/checkers/typescript-ast.mjs');
      typescriptAstChecker = mod.typescriptAstChecker;
    } catch {
      // TypeScript not available — skip
      return;
    }

    const result = await typescriptAstChecker.check(
      'lib/utils.ts',
      fixture('code-with-any-in-comment.ts')
    );
    // If TypeScript is not installed, the checker gracefully passes everything
    if (result.message && result.message.includes('not available')) return;
    assert.equal(result.status, 'passed',
      `Expected no violations but got: ${JSON.stringify(result.violations)}`);
  });

  it('real `any` type annotations DO trigger typescript-ast checker', async () => {
    let typescriptAstChecker;
    try {
      const mod = await import('../../hooks/lib/checkers/typescript-ast.mjs');
      typescriptAstChecker = mod.typescriptAstChecker;
    } catch {
      return;
    }

    const result = await typescriptAstChecker.check(
      'lib/data.ts',
      fixture('code-with-real-any.ts')
    );
    // If TypeScript is not installed, the checker gracefully passes everything — skip
    if (result.message && result.message.includes('not available')) return;
    assert.equal(result.status, 'blocked');
    assert.ok(result.violations.length >= 3, `Expected >= 3 violations, got ${result.violations.length}`);
  });

  it('semantic color tokens pass tailwind checker', async () => {
    const { tailwindTokensChecker } = await import('../../hooks/lib/checkers/tailwind-tokens.mjs');
    const code = `<div className="bg-primary text-foreground border-border hover:bg-primary/90">`;
    const result = await tailwindTokensChecker.check('components/ui/button.tsx', code);
    assert.equal(result.status, 'passed');
  });

  it('comments with secret-like words pass secrets checker', async () => {
    const { secretsChecker } = await import('../../hooks/lib/checkers/secrets.mjs');
    const code = `// Use sk_live_xxx for production\n// The JWT format is eyJ...\nconst x = 1;`;
    const result = await secretsChecker.check('lib/notes.ts', code);
    assert.equal(result.status, 'passed');
  });
});
