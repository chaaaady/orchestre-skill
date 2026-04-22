import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { append, init, read, snapshot } from '../../core/runtime/state-store.mjs';
import { main as permGuardMain } from '../../core/hooks/permission-guard.mjs';

let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orchestre-perm-guard-'));
  init(root);
  process.env.ORCHESTRE_PROJECT_ROOT = root;
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env.ORCHESTRE_PROJECT_ROOT;
  delete process.env.ORCHESTRE_WAVE;
  delete process.env.TOOL_INPUT;
});

function setTool(toolName, toolInput) {
  process.env.TOOL_INPUT = JSON.stringify({ tool_name: toolName, tool_input: toolInput || {} });
}

describe('permission-guard — main() PreToolUse hook', () => {
  it('exits 0 when TOOL_INPUT absent (passthrough)', async () => {
    process.env.ORCHESTRE_WAVE = '0';
    const code = await permGuardMain();
    assert.equal(code, 0);
  });

  it('exits 0 when no active wave and ORCHESTRE_WAVE not set', async () => {
    setTool('Write', { file_path: 'x.ts', content: 'y' });
    const code = await permGuardMain();
    assert.equal(code, 0);
  });

  it('Wave 0 + Write → exits 2 and records permission_denial event', async () => {
    process.env.ORCHESTRE_WAVE = '0';
    append(root, { type: 'wave_start', wave: 0 });
    setTool('Write', { file_path: 'app/foo.ts', content: 'x' });

    const code = await permGuardMain();
    assert.equal(code, 2);

    const denials = read(root, { type: 'permission_denial' });
    assert.equal(denials.length, 1);
    assert.equal(denials[0].data.tool_name, 'Write');
    assert.equal(denials[0].data.rule, 'deny_name');
    assert.equal(denials[0].wave, 0);
  });

  it('Wave 3 + Write → exits 0 (wildcard allow)', async () => {
    process.env.ORCHESTRE_WAVE = '3';
    append(root, { type: 'wave_start', wave: 3 });
    setTool('Write', { file_path: 'app/foo.ts', content: 'x' });
    const code = await permGuardMain();
    assert.equal(code, 0);
  });

  it('Wave 1 + Write to .orchestre/plan.json → exits 0', async () => {
    process.env.ORCHESTRE_WAVE = '1';
    setTool('Write', { file_path: '.orchestre/plan.json', content: '{}' });
    const code = await permGuardMain();
    assert.equal(code, 0);
  });

  it('Wave 1 + Write to app/x.ts → exits 2 (write_restrict)', async () => {
    process.env.ORCHESTRE_WAVE = '1';
    setTool('Write', { file_path: 'app/x.ts', content: 'y' });
    const code = await permGuardMain();
    assert.equal(code, 2);
    const denials = read(root, { type: 'permission_denial' });
    assert.equal(denials[0].data.rule, 'write_restrict');
  });

  it('Wave 4 + Edit → exits 2', async () => {
    process.env.ORCHESTRE_WAVE = '4';
    setTool('Edit', { file_path: '.orchestre/report.md', new_string: 'x' });
    const code = await permGuardMain();
    assert.equal(code, 2);
  });

  it('reads activeWave from snapshot when ORCHESTRE_WAVE not set', async () => {
    append(root, { type: 'wave_start', wave: 0 });
    const snap = snapshot(root);
    assert.equal(snap.activeWave, 0);

    setTool('Write', { file_path: 'x.ts', content: 'y' });
    const code = await permGuardMain();
    assert.equal(code, 2);
  });

  it('mcp_* prefix blocked in Wave 0', async () => {
    process.env.ORCHESTRE_WAVE = '0';
    setTool('mcp_slack_send', {});
    const code = await permGuardMain();
    assert.equal(code, 2);
    const denials = read(root, { type: 'permission_denial' });
    assert.equal(denials[0].data.rule, 'deny_prefix');
  });

  it('flat TOOL_INPUT shape (no tool_input nesting) is handled', async () => {
    process.env.ORCHESTRE_WAVE = '0';
    process.env.TOOL_INPUT = JSON.stringify({ tool_name: 'Write', file_path: 'x.ts', content: 'y' });
    const code = await permGuardMain();
    assert.equal(code, 2);
  });
});
