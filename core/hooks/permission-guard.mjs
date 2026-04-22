#!/usr/bin/env node
/**
 * Permission Guard — PreToolUse access control.
 *
 * Reads TOOL_INPUT (tool_name + tool_input), resolves activeWave from state-store,
 * decides against .orchestre/permissions.json + defaults, records denials.
 *
 * Exit codes:
 *   0 → tool allowed
 *   2 → tool denied (block invocation)
 *
 * Fail-safe: any internal error exits 0 (never block on guard bugs).
 *
 * TOOL_INPUT shape handled:
 *   { "tool_name": "Write", "tool_input": { "file_path": "...", "content": "..." } }
 *   { "tool_name": "Write", "file_path": "...", "content": "..." }   (flat fallback)
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { append, snapshot } from '../runtime/state-store.mjs';
import { contextFor, decide, loadContexts } from '../runtime/permission-context.mjs';

const EXIT_OK = 0;
const EXIT_BLOCK = 2;

function resolveProjectRoot() {
  return process.env.ORCHESTRE_PROJECT_ROOT || process.cwd();
}

function readToolInput() {
  const raw = process.env.TOOL_INPUT;
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const toolName = data.tool_name || data.toolName || null;
    const nested = data.tool_input || data.toolInput || {};
    const filePath = nested.file_path || nested.filePath || data.file_path || data.filePath || null;
    return { toolName, filePath, raw: data };
  } catch {
    return null;
  }
}

export function resolveActiveWave(projectRoot) {
  if (process.env.ORCHESTRE_WAVE !== undefined) {
    const w = process.env.ORCHESTRE_WAVE;
    return /^\d+$/.test(w) ? Number(w) : w;
  }
  const snap = snapshot(projectRoot);
  return snap.activeWave;
}

export async function main() {
  const projectRoot = resolveProjectRoot();
  const stateDir = join(projectRoot, '.orchestre', 'state');
  if (!existsSync(stateDir)) return EXIT_OK;

  const input = readToolInput();
  if (!input || !input.toolName) return EXIT_OK;

  const wave = resolveActiveWave(projectRoot);
  if (wave === null || wave === undefined) return EXIT_OK;

  const contexts = loadContexts(projectRoot);
  const ctx = contextFor(wave, contexts);
  if (!ctx) return EXIT_OK;

  const decision = decide({ context: ctx, toolName: input.toolName, filePath: input.filePath });
  if (decision.allowed) return EXIT_OK;

  try {
    append(projectRoot, {
      type: 'permission_denial',
      wave: typeof wave === 'number' ? wave : null,
      data: { tool_name: input.toolName, file_path: input.filePath, rule: decision.rule, reason: decision.reason },
    });
  } catch {}

  process.stderr.write(
    `\n[orchestre-permission-guard] BLOCKED — wave ${wave}, tool "${input.toolName}" (rule: ${decision.rule}). ` +
    `${decision.reason || ''}\n`
  );
  return EXIT_BLOCK;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(code => process.exit(code)).catch(() => process.exit(EXIT_OK));
}
