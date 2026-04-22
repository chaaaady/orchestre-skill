import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DEFAULT_CONTEXTS, contextFor, decide, loadContexts,
} from '../../core/runtime/permission-context.mjs';

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'orchestre-perms-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe('permission-context — defaults mirror spec', () => {
  it('Wave 0 denies Write/Edit/Bash/Agent and mcp_*', () => {
    const c = DEFAULT_CONTEXTS['0'];
    assert.deepEqual(c.deny_names, ['Write', 'Edit', 'Bash', 'Agent']);
    assert.deepEqual(c.deny_prefixes, ['mcp_']);
  });

  it('Wave 3 allows everything via wildcard', () => {
    assert.deepEqual(DEFAULT_CONTEXTS['3'].allow, ['*']);
    assert.equal(DEFAULT_CONTEXTS['3'].deny_names.length, 0);
  });

  it('Wave 1/2 restrict writes to .orchestre/', () => {
    assert.equal(DEFAULT_CONTEXTS['1'].write_restrict, '.orchestre/');
    assert.equal(DEFAULT_CONTEXTS['2'].write_restrict, '.orchestre/');
  });
});

describe('permission-context — decide()', () => {
  const ctx0 = DEFAULT_CONTEXTS['0'];
  const ctx1 = DEFAULT_CONTEXTS['1'];
  const ctx3 = DEFAULT_CONTEXTS['3'];
  const ctx4 = DEFAULT_CONTEXTS['4'];

  it('Wave 0: Read allowed, Write blocked', () => {
    assert.equal(decide({ context: ctx0, toolName: 'Read' }).allowed, true);
    const r = decide({ context: ctx0, toolName: 'Write', filePath: 'app/x.ts' });
    assert.equal(r.allowed, false);
    assert.equal(r.rule, 'deny_name');
  });

  it('Wave 0: mcp_ prefix blocked (case-insensitive)', () => {
    const r = decide({ context: ctx0, toolName: 'MCP_fetch' });
    assert.equal(r.allowed, false);
    assert.equal(r.rule, 'deny_prefix');
  });

  it('Wave 3: wildcard allows any arbitrary tool', () => {
    assert.equal(decide({ context: ctx3, toolName: 'ExoticTool' }).allowed, true);
    assert.equal(decide({ context: ctx3, toolName: 'Bash' }).allowed, true);
  });

  it('Wave 1: Write to .orchestre/plan.json allowed; to app/x.ts blocked via write_restrict', () => {
    const allowed = decide({ context: ctx1, toolName: 'Write', filePath: '.orchestre/plan.json' });
    assert.equal(allowed.allowed, true);
    const blocked = decide({ context: ctx1, toolName: 'Write', filePath: 'app/x.ts' });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.rule, 'write_restrict');
  });

  it('Wave 4: Edit always blocked even for .orchestre/', () => {
    const r = decide({ context: ctx4, toolName: 'Edit', filePath: '.orchestre/foo.md' });
    assert.equal(r.allowed, false);
    assert.equal(r.rule, 'deny_name');
  });

  it('Wave 4: Write to .orchestre/ allowed, write to app/ blocked via write_restrict', () => {
    assert.equal(decide({ context: ctx4, toolName: 'Write', filePath: '.orchestre/report.json' }).allowed, true);
    const blocked = decide({ context: ctx4, toolName: 'Write', filePath: 'app/page.tsx' });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.rule, 'write_restrict');
  });

  it('no context or no toolName → allowed (fail-open)', () => {
    assert.equal(decide({ context: null, toolName: 'Anything' }).allowed, true);
    assert.equal(decide({ context: ctx0, toolName: null }).allowed, true);
  });

  it('tool not in allow list (explicit) → not_in_allow', () => {
    const r = decide({ context: ctx0, toolName: 'TaskCreate' });
    assert.equal(r.allowed, false);
    assert.equal(r.rule, 'not_in_allow');
  });
});

describe('permission-context — loadContexts() override', () => {
  it('returns defaults when no file', () => {
    const c = loadContexts(root);
    assert.deepEqual(c['3'].allow, ['*']);
  });

  it('merges per-wave overrides with defaults', () => {
    mkdirSync(join(root, '.orchestre'), { recursive: true });
    writeFileSync(join(root, '.orchestre', 'permissions.json'),
      JSON.stringify({ '0': { allow: ['Read'] } }));
    const c = loadContexts(root);
    assert.deepEqual(c['0'].allow, ['Read']);
    assert.deepEqual(c['0'].deny_names, DEFAULT_CONTEXTS['0'].deny_names);
  });

  it('falls back to defaults on invalid JSON', () => {
    mkdirSync(join(root, '.orchestre'), { recursive: true });
    writeFileSync(join(root, '.orchestre', 'permissions.json'), '{{bad');
    const c = loadContexts(root);
    assert.deepEqual(c, { ...DEFAULT_CONTEXTS });
  });

  it('contextFor returns null for unknown wave', () => {
    assert.equal(contextFor(99, DEFAULT_CONTEXTS), null);
  });
});
