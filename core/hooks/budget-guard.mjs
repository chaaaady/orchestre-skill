#!/usr/bin/env node
/**
 * Budget Guard — PostToolUse kill-switch.
 *
 * Reads .orchestre/budget.json (max_usd, kill_threshold_pct) + state-store snapshot.
 * Exit codes:
 *   0  → under budget, continue
 *   2  → budget exceeded, block further tool calls (writes wave_end event for resume)
 *
 * Design: runs after EVERY tool call. Must be fast (< 50ms) and crash-safe:
 * any internal error exits 0, the guard never blocks on its own bugs.
 *
 * Config shape (.orchestre/budget.json):
 *   { "max_usd": 10, "kill_threshold_pct": 120, "warn_threshold_pct": 75 }
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { append, snapshot } from '../runtime/state-store.mjs';
import { totalSoFar } from '../runtime/cost-tracker.mjs';

const DEFAULT_CONFIG = { max_usd: 10, kill_threshold_pct: 120, warn_threshold_pct: 75 };
const EXIT_OK = 0;
const EXIT_BLOCK = 2;

function resolveProjectRoot() {
  return process.env.ORCHESTRE_PROJECT_ROOT || process.cwd();
}

function readConfig(projectRoot) {
  const p = join(projectRoot, '.orchestre', 'budget.json');
  if (!existsSync(p)) return null;
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(p, 'utf8')) }; }
  catch { return null; }
}

function writeSentinel(projectRoot, payload) {
  const p = join(projectRoot, '.orchestre', 'state', 'BUDGET_KILLED');
  try { writeFileSync(p, JSON.stringify(payload, null, 2)); } catch {}
}

export function evaluate(projectRoot, config = null) {
  const cfg = config || readConfig(projectRoot) || DEFAULT_CONFIG;
  const spent = totalSoFar(projectRoot).usd;
  const killLimit = cfg.max_usd * (cfg.kill_threshold_pct / 100);
  const warnLimit = cfg.max_usd * (cfg.warn_threshold_pct / 100);

  if (spent > killLimit) return { status: 'kill', spent, killLimit, config: cfg };
  if (spent > warnLimit) return { status: 'warn', spent, warnLimit, config: cfg };
  return { status: 'ok', spent, config: cfg };
}

export async function main() {
  const projectRoot = resolveProjectRoot();
  const stateDir = join(projectRoot, '.orchestre', 'state');
  if (!existsSync(stateDir)) return EXIT_OK;

  const cfg = readConfig(projectRoot);
  if (!cfg) return EXIT_OK;

  const result = evaluate(projectRoot, cfg);

  if (result.status === 'kill') {
    const snap = snapshot(projectRoot);
    const wave = snap.activeWave !== null ? snap.activeWave : 'unknown';
    try {
      append(projectRoot, {
        type: 'wave_end',
        wave: typeof wave === 'number' ? wave : null,
        data: { stop_reason: 'budget_exceeded', spent_usd: result.spent, limit_usd: result.killLimit },
      });
    } catch {}
    writeSentinel(projectRoot, { wave, spent: result.spent, killLimit: result.killLimit, at: new Date().toISOString() });
    process.stderr.write(
      `\n[orchestre-budget-guard] BLOCKED — spent $${result.spent.toFixed(4)} > kill limit $${result.killLimit.toFixed(4)} ` +
      `(${cfg.kill_threshold_pct}% of $${cfg.max_usd}). Wave ${wave} stopped for resume.\n`
    );
    return EXIT_BLOCK;
  }

  if (result.status === 'warn') {
    process.stderr.write(
      `[orchestre-budget-guard] warn — spent $${result.spent.toFixed(4)} > $${result.warnLimit.toFixed(4)} ` +
      `(${cfg.warn_threshold_pct}% of $${cfg.max_usd}).\n`
    );
  }

  return EXIT_OK;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(code => process.exit(code)).catch(() => process.exit(EXIT_OK));
}
