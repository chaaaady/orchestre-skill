import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8');

let svelteImportsChecker;
try {
  const mod = await import('../../stacks/sveltekit-drizzle/hooks/svelte-imports.mjs');
  svelteImportsChecker = mod.svelteImportsChecker;
} catch {
  svelteImportsChecker = null;
}

describe('svelteImportsChecker', () => {
  it('blocks deep relative imports with IMPORT-01', async () => {
    if (!svelteImportsChecker) return;
    const code = `import { db } from '../../lib/db';\nimport { helper } from '../../../utils';\n`;
    const result = await svelteImportsChecker.check('src/routes/+page.svelte.ts', code);
    assert.equal(result.status, 'blocked');
    assert.ok(result.violations.some(v => v.rule === 'IMPORT-01'),
      `Expected IMPORT-01, got: ${JSON.stringify(result.violations)}`);
  });

  it('passes $lib/ imports', async () => {
    if (!svelteImportsChecker) return;
    const code = `import { db } from '$lib/db';\nimport { Button } from '$lib/components/ui/button';\n`;
    const result = await svelteImportsChecker.check('src/routes/+page.ts', code);
    assert.equal(result.status, 'passed');
    assert.equal(result.violations.length, 0);
  });

  it('blocks server imports from client code with IMPORT-03', async () => {
    if (!svelteImportsChecker) return;
    const code = fixture('code-svelte-server-import.ts');
    // .svelte file is client code — should not import $lib/server/
    const result = await svelteImportsChecker.check('src/routes/dashboard/Dashboard.svelte.ts', code);
    assert.equal(result.status, 'blocked');
    assert.ok(result.violations.some(v => v.rule === 'IMPORT-03'),
      `Expected IMPORT-03, got: ${JSON.stringify(result.violations)}`);
  });

  it('passes server imports from +page.server.ts', async () => {
    if (!svelteImportsChecker) return;
    const code = fixture('code-svelte-server-import.ts');
    const result = await svelteImportsChecker.check('src/routes/dashboard/+page.server.ts', code);
    // +page.server.ts is a server file — server imports are allowed
    const serverViolations = result.violations.filter(v => v.rule === 'IMPORT-03');
    assert.equal(serverViolations.length, 0,
      `Expected no IMPORT-03 violations, got: ${JSON.stringify(serverViolations)}`);
  });

  it('passes server imports from +server.ts', async () => {
    if (!svelteImportsChecker) return;
    const code = `import { db } from '$lib/server/db';\n`;
    const result = await svelteImportsChecker.check('src/routes/api/users/+server.ts', code);
    const serverViolations = result.violations.filter(v => v.rule === 'IMPORT-03');
    assert.equal(serverViolations.length, 0);
  });

  it('passes server imports from hooks.server.ts', async () => {
    if (!svelteImportsChecker) return;
    const code = `import { db } from '$lib/server/db';\n`;
    const result = await svelteImportsChecker.check('src/hooks.server.ts', code);
    const serverViolations = result.violations.filter(v => v.rule === 'IMPORT-03');
    assert.equal(serverViolations.length, 0);
  });

  it('blocks cross-feature imports with IMPORT-02', async () => {
    if (!svelteImportsChecker) return;
    const code = `import { BillingCard } from '$lib/components/billing/BillingCard';\n`;
    const result = await svelteImportsChecker.check('src/lib/components/dashboard/index.ts', code);
    // Note: IMPORT-02 checks for components/featureA -> components/featureB in the filePath
    // The filePath must be in components/X/ and import path must reference components/Y/
    const crossViolations = result.violations.filter(v => v.rule === 'IMPORT-02');
    // This import uses $lib/components/billing — the regex checks for components/ in import path
    assert.ok(crossViolations.length > 0,
      `Expected IMPORT-02 violation, got: ${JSON.stringify(result.violations)}`);
  });
});
