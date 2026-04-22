import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';

import { detect, buildSeatbeltProfile, buildCommand, run, DEFAULT_WRITE_ROOTS } from '../../core/runtime/sandbox.mjs';

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'orchestre-sbx-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe('sandbox — detect()', () => {
  it('returns a backend string + either path (seatbelt/bubblewrap) or reason (none)', () => {
    const d = detect();
    assert.ok(['seatbelt', 'bubblewrap', 'none'].includes(d.backend));
    if (d.backend === 'none') assert.ok(typeof d.reason === 'string' && d.reason.length > 0);
    else assert.ok(typeof d.path === 'string' && d.path.length > 0);
  });
});

describe('sandbox — buildSeatbeltProfile()', () => {
  it('denies everything by default, allows project subpath for write', () => {
    const profile = buildSeatbeltProfile({ projectRoot: root, writeRoots: ['src'], allowNetwork: false });
    assert.match(profile, /\(deny default\)/);
    assert.match(profile, /\(deny network\*\)/);
    assert.match(profile, new RegExp(`\\(subpath "${root}/src"\\)`));
  });

  it('opens network when allowNetwork=true', () => {
    const profile = buildSeatbeltProfile({ projectRoot: root, writeRoots: [], allowNetwork: true });
    assert.match(profile, /\(allow network\*\)/);
  });

  it('always allows localhost regardless of allowNetwork', () => {
    const profile = buildSeatbeltProfile({ projectRoot: root, writeRoots: [], allowNetwork: false });
    assert.match(profile, /localhost/);
  });
});

describe('sandbox — buildCommand()', () => {
  it('returns null for backend=none', () => {
    const r = buildCommand({ backend: 'none', reason: 'x' }, { projectRoot: root, argv: ['echo', 'hi'] });
    assert.equal(r, null);
  });

  it('throws if argv is missing or empty', () => {
    assert.throws(() => buildCommand({ backend: 'seatbelt', path: '/usr/bin/sandbox-exec' }, { projectRoot: root }),
      /argv required/);
    assert.throws(() => buildCommand({ backend: 'seatbelt', path: '/usr/bin/sandbox-exec' }, { projectRoot: root, argv: [] }),
      /argv required/);
  });

  it('seatbelt: writes a .sb file and returns -f <path> … argv', () => {
    const built = buildCommand({ backend: 'seatbelt', path: '/usr/bin/sandbox-exec' },
      { projectRoot: root, argv: ['echo', 'hi'], writeRoots: ['src'], allowNetwork: false });
    assert.equal(built.cmd, '/usr/bin/sandbox-exec');
    assert.equal(built.args[0], '-f');
    assert.ok(existsSync(built.profilePath));
    const profile = readFileSync(built.profilePath, 'utf8');
    assert.match(profile, /deny default/);
    assert.deepEqual(built.args.slice(2), ['echo', 'hi']);
  });

  it('bubblewrap: chains --ro-bind / and --bind projectRoot + --unshare-net when !allowNetwork', () => {
    const built = buildCommand({ backend: 'bubblewrap', path: '/usr/bin/bwrap' },
      { projectRoot: root, argv: ['node', '-e', '1'], allowNetwork: false });
    assert.equal(built.cmd, '/usr/bin/bwrap');
    assert.ok(built.args.includes('--ro-bind'));
    assert.ok(built.args.includes('--unshare-net'));
    assert.ok(built.args.some(a => a === root));
    // argv is at the end
    assert.deepEqual(built.args.slice(-3), ['node', '-e', '1']);
  });

  it('default writeRoots includes .orchestre/state', () => {
    assert.ok(DEFAULT_WRITE_ROOTS.includes('.orchestre/state'));
  });
});

describe('sandbox — run() integration (platform-dependent)', () => {
  it('rejects if projectRoot does not exist', async () => {
    await assert.rejects(() => run({ projectRoot: '/does/not/exist/xyz', argv: ['echo', 'hi'] }),
      /projectRoot not found/);
  });

  it('when sandbox available, runs a harmless echo inside the sandbox and exits 0', async (t) => {
    const d = detect();
    if (d.backend === 'none') return t.skip('no sandbox backend on this host');
    if (platform() !== 'darwin' && platform() !== 'linux') return t.skip('unsupported platform');
    const r = await run({ projectRoot: root, argv: ['/bin/echo', 'orchestre'] });
    assert.equal(r.sandboxed, true);
    assert.equal(r.exitCode, 0);
  });
});
