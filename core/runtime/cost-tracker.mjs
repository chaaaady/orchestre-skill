/**
 * Cost Tracker — Domain layer on top of state-store.
 *
 * Pricing from core/infrastructure/cost-tracker.md.
 * Exposes record()/totalSoFar()/remaining()/projectedCostBeforeExecute().
 * BudgetExceededError is raised by guards, not here — this module is pure measurement.
 */
import { append, snapshot } from './state-store.mjs';

export const PRICING = Object.freeze({
  'claude-opus-4-6':   { in: 15.00, out: 75.00 },
  'claude-opus-4-7':   { in: 15.00, out: 75.00 },
  'claude-sonnet-4-6': {  in: 3.00, out: 15.00 },
  'claude-sonnet-4-5': {  in: 3.00, out: 15.00 },
  'claude-haiku-4-5':  {  in: 0.80, out:  4.00 },
});

const MILLION = 1_000_000;

export class BudgetExceededError extends Error {
  constructor({ limit, actual, wave, label }) {
    super(`Budget exceeded: ${actual.toFixed(4)} USD > limit ${limit.toFixed(4)} USD (wave ${wave}${label ? `, ${label}` : ''})`);
    this.name = 'BudgetExceededError';
    this.limit = limit;
    this.actual = actual;
    this.wave = wave;
    this.label = label || null;
  }
}

export function priceOf(model) {
  return PRICING[model] || null;
}

export function estimateCost({ model, tokens_in = 0, tokens_out = 0 }) {
  const p = priceOf(model);
  if (!p) return 0;
  return (tokens_in * p.in + tokens_out * p.out) / MILLION;
}

export function record(projectRoot, { wave, label, model, tokens_in = 0, tokens_out = 0, stop_reason = 'completed' }) {
  if (wave === undefined || wave === null) throw new TypeError('record: wave is required');
  const usd = estimateCost({ model, tokens_in, tokens_out });
  return append(projectRoot, {
    type: 'cost',
    wave,
    data: { label: label || null, model: model || null, tokens_in, tokens_out, usd, stop_reason },
  });
}

export function totalSoFar(projectRoot) {
  return snapshot(projectRoot).costSoFar;
}

export function remaining(projectRoot, budgetUsd) {
  const spent = totalSoFar(projectRoot).usd;
  return Math.max(0, budgetUsd - spent);
}

export function projectedCostBeforeExecute(projectRoot, { model, tokens_in, tokens_out, wave, label }, budgetUsd) {
  const spent = totalSoFar(projectRoot).usd;
  const projected = estimateCost({ model, tokens_in, tokens_out });
  const after = spent + projected;
  return {
    spent,
    projected,
    afterExecute: after,
    budget: budgetUsd,
    wouldExceed: budgetUsd !== undefined && after > budgetUsd,
    wave,
    label: label || null,
  };
}

export function guardBudget(projectRoot, budgetUsd, { wave, label } = {}) {
  const spent = totalSoFar(projectRoot).usd;
  if (spent > budgetUsd) throw new BudgetExceededError({ limit: budgetUsd, actual: spent, wave, label });
  return { spent, remaining: budgetUsd - spent };
}
