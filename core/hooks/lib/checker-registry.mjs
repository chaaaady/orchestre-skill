/**
 * Dynamic Checker Registry — loads checkers from core + active stack.
 *
 * Core checkers (always loaded):
 *   - secrets.mjs (universal secret detection)
 *
 * Stack checkers (loaded from stacks/{id}/hooks/):
 *   - Defined in stack.json -> hooks.checkers
 *   - e.g. tailwind-tokens, typescript-ast, import-paths for nextjs-supabase
 *
 * Resolution order:
 *   1. Read .orchestre/install-manifest.json to find active stack
 *   2. Fallback to ORCHESTRE_STACK env var
 *   3. Fallback to 'nextjs-supabase' default
 */
import { secretsChecker } from './checkers/secrets.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _stackCheckersCache = null;
let _resolvedStack = null;

function resolveStack() {
  if (_resolvedStack) return _resolvedStack;

  const manifestPaths = [
    join(process.cwd(), '.orchestre', 'install-manifest.json'),
    join(__dirname, '..', '..', '..', '.orchestre', 'install-manifest.json'),
  ];
  for (const p of manifestPaths) {
    try {
      const manifest = JSON.parse(readFileSync(p, 'utf8'));
      if (manifest.stack) { _resolvedStack = manifest.stack; return _resolvedStack; }
    } catch {}
  }

  if (process.env.ORCHESTRE_STACK) {
    _resolvedStack = process.env.ORCHESTRE_STACK;
    return _resolvedStack;
  }

  _resolvedStack = 'nextjs-supabase';
  return _resolvedStack;
}

async function loadStackCheckers(stackId) {
  if (_stackCheckersCache) return _stackCheckersCache;

  const checkers = [];
  const stackHooksDirs = [
    join(process.cwd(), 'stacks', stackId, 'hooks'),
    join(__dirname, '..', '..', '..', 'stacks', stackId, 'hooks'),
  ];

  let hooksDir = null;
  for (const dir of stackHooksDirs) {
    if (existsSync(dir)) { hooksDir = dir; break; }
  }

  if (!hooksDir) { _stackCheckersCache = checkers; return checkers; }

  // Load stack.json to see which checkers are enabled
  const stackJsonPaths = [
    join(process.cwd(), 'stacks', stackId, 'stack.json'),
    join(__dirname, '..', '..', '..', 'stacks', stackId, 'stack.json'),
  ];

  let enabledCheckers = {};
  for (const p of stackJsonPaths) {
    try {
      const stack = JSON.parse(readFileSync(p, 'utf8'));
      enabledCheckers = (stack.hooks && stack.hooks.checkers) || {};
      break;
    } catch {}
  }

  const checkerFiles = {
    'tailwind-tokens': 'tailwind-tokens.mjs',
    'typescript-ast': 'typescript-ast.mjs',
    'import-paths': 'import-paths.mjs',
  };

  for (const [name, enabled] of Object.entries(enabledCheckers)) {
    if (!enabled) continue;
    const file = checkerFiles[name] || `${name}.mjs`;
    const checkerPath = join(hooksDir, file);
    if (existsSync(checkerPath)) {
      try {
        const mod = await import(checkerPath);
        const checker = Object.values(mod).find(v => v && typeof v.check === 'function');
        if (checker) checkers.push(checker);
      } catch {}
    }
  }

  _stackCheckersCache = checkers;
  return checkers;
}

const CORE_CHECKERS = {
  'pre-write': {
    ts: [secretsChecker], tsx: [secretsChecker],
    js: [secretsChecker], jsx: [secretsChecker],
    mjs: [secretsChecker], cjs: [secretsChecker],
    py: [secretsChecker], go: [secretsChecker],
  },
  'post-write': {},
  'pre-commit': {
    ts: [secretsChecker], tsx: [secretsChecker],
    js: [secretsChecker], jsx: [secretsChecker],
    mjs: [secretsChecker], cjs: [secretsChecker],
    env: [secretsChecker], py: [secretsChecker],
  },
};

const STACK_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'svelte', 'vue', 'py'];

export async function getCheckers(mode, filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.') + 1);
  const modeMap = CORE_CHECKERS[mode] || CORE_CHECKERS['pre-write'];
  const core = modeMap[ext] || [];

  if (mode === 'post-write' || !STACK_EXTENSIONS.includes(ext)) return core;

  const stackId = resolveStack();
  const stackCheckers = await loadStackCheckers(stackId);
  return [...core, ...stackCheckers];
}
