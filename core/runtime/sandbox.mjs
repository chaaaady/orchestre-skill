/**
 * Sandbox wrapper — runs a command with filesystem + network restrictions.
 *
 * Backends:
 *   - macOS: sandbox-exec with a generated Seatbelt profile (.sb)
 *   - Linux: bubblewrap (bwrap) — ro-bind /, bind project root
 *   - Fallback: spawn without sandbox, returns { sandboxed: false, reason }
 *
 * Policy (Wave 3 default):
 *   - Read-only: project root (except writeRoots)
 *   - Writable: writeRoots (defaults to ["src", "app", "lib", "components", "actions", ".orchestre/state"])
 *   - Network: blocked by default. allowNetwork=true opens egress.
 *
 * This module is I/O-agnostic: detect() + buildCommand() are pure, run() spawns.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, accessSync, constants } from 'node:fs';
import { tmpdir, platform } from 'node:os';
import { join, resolve } from 'node:path';

export const DEFAULT_WRITE_ROOTS = ['src', 'app', 'lib', 'components', 'actions', 'pages', 'public', '.orchestre/state'];

export function detect() {
  const p = platform();
  if (p === 'darwin') {
    try { accessSync('/usr/bin/sandbox-exec', constants.X_OK); return { backend: 'seatbelt', path: '/usr/bin/sandbox-exec' }; }
    catch { return { backend: 'none', reason: 'sandbox-exec not found' }; }
  }
  if (p === 'linux') {
    for (const candidate of ['/usr/bin/bwrap', '/usr/local/bin/bwrap']) {
      try { accessSync(candidate, constants.X_OK); return { backend: 'bubblewrap', path: candidate }; } catch {}
    }
    return { backend: 'none', reason: 'bwrap not found (apt install bubblewrap)' };
  }
  return { backend: 'none', reason: `unsupported platform: ${p}` };
}

export function buildSeatbeltProfile({ projectRoot, writeRoots, allowNetwork }) {
  const root = resolve(projectRoot);
  const writes = writeRoots.map(r => resolve(root, r));
  const writeRules = writes.map(w => `  (subpath "${w}")`).join('\n');

  return [
    '(version 1)',
    '(deny default)',
    '(allow process-fork)',
    '(allow process-exec)',
    '(allow signal (target self))',
    '(allow sysctl-read)',
    '(allow file-read*)',
    '(allow file-write*',
    writeRules,
    '  (subpath "/tmp")',
    '  (subpath "/private/tmp")',
    '  (subpath "/private/var/folders")',
    ')',
    allowNetwork ? '(allow network*)' : '(deny network*)',
    '(allow network* (local ip "localhost:*"))',
    '(allow mach-lookup)',
    '(allow ipc-posix-shm)',
  ].join('\n') + '\n';
}

export function buildCommand(detected, { projectRoot, writeRoots, allowNetwork, argv }) {
  if (!Array.isArray(argv) || argv.length === 0) throw new TypeError('argv required');
  const roots = writeRoots && writeRoots.length ? writeRoots : DEFAULT_WRITE_ROOTS;

  if (detected.backend === 'seatbelt') {
    const profile = buildSeatbeltProfile({ projectRoot, writeRoots: roots, allowNetwork: !!allowNetwork });
    const dir = mkdtempSync(join(tmpdir(), 'orchestre-sb-'));
    const profilePath = join(dir, 'wave3.sb');
    writeFileSync(profilePath, profile);
    return { cmd: detected.path, args: ['-f', profilePath, ...argv], profilePath };
  }

  if (detected.backend === 'bubblewrap') {
    const root = resolve(projectRoot);
    const args = [
      '--ro-bind', '/', '/',
      '--proc', '/proc',
      '--dev', '/dev',
      '--tmpfs', '/tmp',
      '--bind', root, root,
      '--chdir', root,
    ];
    if (!allowNetwork) args.push('--unshare-net');
    args.push(...argv);
    return { cmd: detected.path, args };
  }

  return null;
}

export function run({ projectRoot, argv, writeRoots, allowNetwork = false, env } = {}) {
  if (!existsSync(projectRoot)) return Promise.reject(new Error(`projectRoot not found: ${projectRoot}`));
  const detected = detect();

  if (detected.backend === 'none') {
    return Promise.resolve({ sandboxed: false, reason: detected.reason, exitCode: null });
  }

  const built = buildCommand(detected, { projectRoot, writeRoots, allowNetwork, argv });
  if (!built) return Promise.resolve({ sandboxed: false, reason: 'buildCommand returned null', exitCode: null });

  return new Promise((resolvePromise) => {
    const child = spawn(built.cmd, built.args, {
      cwd: projectRoot,
      env: env || process.env,
      stdio: 'inherit',
    });
    child.on('exit', (code, signal) => {
      resolvePromise({ sandboxed: true, backend: detected.backend, exitCode: code, signal });
    });
    child.on('error', (err) => {
      resolvePromise({ sandboxed: false, reason: err.message, exitCode: null });
    });
  });
}
