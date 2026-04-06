import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8');

let importPathsChecker;
try {
  const mod = await import('../../stacks/nextjs-supabase/hooks/import-paths.mjs');
  importPathsChecker = mod.importPathsChecker;
} catch {
  importPathsChecker = null;
}

describe('importPathsChecker', () => {
  it('blocks deep relative imports (../../) with IMPORT-01', async () => {
    if (!importPathsChecker) return;
    const code = fixture('code-deep-imports.ts');
    const result = await importPathsChecker.check('components/dashboard/index.ts', code);
    assert.equal(result.status, 'blocked');
    assert.ok(result.violations.some(v => v.rule === 'IMPORT-01'),
      `Expected IMPORT-01 violation, got: ${JSON.stringify(result.violations)}`);
  });

  it('passes @/ alias imports', async () => {
    if (!importPathsChecker) return;
    const code = `import { Button } from '@/components/ui/button';\nimport { getDonations } from '@/lib/queries/donations';\n`;
    const result = await importPathsChecker.check('components/dashboard/index.ts', code);
    assert.equal(result.status, 'passed');
    assert.equal(result.violations.length, 0);
  });

  it('blocks cross-feature imports with IMPORT-02', async () => {
    if (!importPathsChecker) return;
    const code = fixture('code-cross-feature.ts');
    // File is in components/dashboard/, importing from components/billing/
    const result = await importPathsChecker.check('components/dashboard/index.ts', code);
    assert.equal(result.status, 'blocked');
    assert.ok(result.violations.some(v => v.rule === 'IMPORT-02'),
      `Expected IMPORT-02 violation, got: ${JSON.stringify(result.violations)}`);
  });

  it('passes imports from components/ui/ (shared exception)', async () => {
    if (!importPathsChecker) return;
    const code = `import { Button } from '@/components/ui/button';\n`;
    const result = await importPathsChecker.check('components/dashboard/index.ts', code);
    assert.equal(result.status, 'passed');
    assert.equal(result.violations.length, 0);
  });

  it('passes single-level relative imports (./utils)', async () => {
    if (!importPathsChecker) return;
    const code = `import { helper } from './utils';\n`;
    const result = await importPathsChecker.check('components/dashboard/index.ts', code);
    assert.equal(result.status, 'passed');
    assert.equal(result.violations.length, 0);
  });

  it('does not flag cross-feature when file is in components/ui/', async () => {
    if (!importPathsChecker) return;
    const code = `import { BillingCard } from '@/components/billing/BillingCard';\n`;
    // File is in ui/ — ui is the shared exception, it can import anything
    const result = await importPathsChecker.check('components/ui/composed-card.ts', code);
    assert.equal(result.status, 'passed');
  });
});
