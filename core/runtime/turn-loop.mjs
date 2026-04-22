/**
 * Turn-loop enforcer — wave-scoped turn + token budget gate.
 *
 * Makes core/infrastructure/query-engine.md executable.
 * Defaults mirror the table from that spec; override via .orchestre/turn-limits.json.
 *
 * API:
 *   getLimits(wave, overrides?)        → {max_turns, max_budget_tokens, compact_after}
 *   recordTurn(root, {wave, tokens_in, tokens_out})  → appends 'turn' event with usage
 *   assertTurnBudget(root, wave)        → throws MaxTurnsExceededError / MaxTokensExceededError
 *   compactNeeded(root, wave)           → boolean (true when turn count >= compact_after)
 *   loadLimits(root)                    → merged defaults + on-disk overrides
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { append, snapshot } from './state-store.mjs';

export const DEFAULT_LIMITS = Object.freeze({
  '0':        { max_turns:  3, max_budget_tokens:  15000, compact_after:  5 },
  '1':        { max_turns:  8, max_budget_tokens:  80000, compact_after: 10 },
  'design':   { max_turns:  5, max_budget_tokens:  30000, compact_after:  8 },
  '2':        { max_turns:  8, max_budget_tokens:  80000, compact_after: 10 },
  '3-init':   { max_turns: 15, max_budget_tokens: 100000, compact_after: 18 },
  '3':        { max_turns: 12, max_budget_tokens:  75000, compact_after: 15 },
  '4':        { max_turns: 10, max_budget_tokens:  60000, compact_after: 12 },
});

export class MaxTurnsExceededError extends Error {
  constructor({ wave, turnsUsed, limit }) {
    super(`Wave ${wave}: max_turns exceeded (${turnsUsed}/${limit})`);
    this.name = 'MaxTurnsExceededError';
    this.wave = wave; this.turnsUsed = turnsUsed; this.limit = limit;
  }
}

export class MaxTokensExceededError extends Error {
  constructor({ wave, tokensUsed, limit }) {
    super(`Wave ${wave}: max_budget_tokens exceeded (${tokensUsed}/${limit})`);
    this.name = 'MaxTokensExceededError';
    this.wave = wave; this.tokensUsed = tokensUsed; this.limit = limit;
  }
}

export function loadLimits(projectRoot) {
  const p = join(projectRoot, '.orchestre', 'turn-limits.json');
  if (!existsSync(p)) return { ...DEFAULT_LIMITS };
  try {
    const custom = JSON.parse(readFileSync(p, 'utf8'));
    const merged = { ...DEFAULT_LIMITS };
    for (const key of Object.keys(custom || {})) {
      merged[key] = { ...(DEFAULT_LIMITS[key] || {}), ...custom[key] };
    }
    return merged;
  } catch {
    return { ...DEFAULT_LIMITS };
  }
}

export function getLimits(wave, overrides) {
  const key = String(wave);
  const all = overrides || DEFAULT_LIMITS;
  return all[key] || DEFAULT_LIMITS[key] || null;
}

export function recordTurn(projectRoot, { wave, tokens_in = 0, tokens_out = 0, label = null } = {}) {
  if (wave === undefined || wave === null) throw new TypeError('recordTurn: wave is required');
  return append(projectRoot, {
    type: 'turn',
    wave,
    data: { tokens_in, tokens_out, label },
  });
}

export function state(projectRoot, wave) {
  const snap = snapshot(projectRoot);
  const key = String(wave);
  const w = snap.byWave[key] || { turns: 0, tokens_in: 0, tokens_out: 0 };
  return {
    turnsUsed: w.turns || 0,
    tokensUsed: (w.tokens_in || 0) + (w.tokens_out || 0),
  };
}

export function assertTurnBudget(projectRoot, wave, overrides) {
  const limits = getLimits(wave, overrides || loadLimits(projectRoot));
  if (!limits) return { limits: null, ...state(projectRoot, wave) };

  const { turnsUsed, tokensUsed } = state(projectRoot, wave);
  if (turnsUsed >= limits.max_turns) {
    throw new MaxTurnsExceededError({ wave, turnsUsed, limit: limits.max_turns });
  }
  if (tokensUsed >= limits.max_budget_tokens) {
    throw new MaxTokensExceededError({ wave, tokensUsed, limit: limits.max_budget_tokens });
  }
  return { limits, turnsUsed, tokensUsed };
}

export function compactNeeded(projectRoot, wave, overrides) {
  const limits = getLimits(wave, overrides || loadLimits(projectRoot));
  if (!limits) return false;
  const { turnsUsed } = state(projectRoot, wave);
  return turnsUsed >= limits.compact_after;
}
