/**
 * Plan Gate — 10-second checkpoint between Wave 2 and Wave 3.
 *
 * Rationale: Wave 2 plans can be wrong. If Wave 3 runs on a bad plan, tokens
 * are burned before anyone notices. Devin 2.0 shipped this pattern and it cut
 * wasted runs dramatically. Orchestre's cost is much lower with a 10s human gate.
 *
 * Behaviour:
 *   - In interactive mode, the Wave 2 agent renders prompt() via AskUserQuestion,
 *     then calls parseResponse(answer). ENTER / "go" / "y" → proceed; "r" → replan;
 *     "x" / "abort" → abort.
 *   - In non-interactive mode (env ORCHESTRE_NO_GATE=1 or stdin is not a TTY),
 *     evaluate() returns decision='go' after the default timeout (60s by default).
 *   - Every decision is persisted as a 'plan_gate_decision' event for audit.
 */
import { append } from './state-store.mjs';

export const DEFAULT_TIMEOUT_SECONDS = 60;

export function summarizePlan(plan) {
  if (!plan || typeof plan !== 'object') {
    return { valid: false, reason: 'plan is not an object' };
  }

  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const features = new Set(tasks.map(t => t.feature_id).filter(Boolean));
  const parallelGroups = new Set(tasks.map(t => t.parallel_group).filter(g => g !== undefined && g !== null));

  const cost = plan.cost_estimate || {};
  const total = Number(cost.total_usd) || 0;
  const perFeature = cost.per_feature || {};

  const council = plan.council_checks || {};
  const warnings = Array.isArray(council.warnings) ? council.warnings.length : 0;

  return {
    valid: true,
    version: plan.version || null,
    project_id: plan.project_id || null,
    tasks: tasks.length,
    features: features.size,
    parallel_groups: parallelGroups.size,
    cost_total_usd: total,
    cost_per_feature: perFeature,
    council_warnings: warnings,
    profile: cost.profile || null,
  };
}

export function renderPrompt(summary) {
  if (!summary || !summary.valid) return 'Plan is invalid or missing — aborting Wave 3. Reason: ' + (summary?.reason || 'unknown');

  const bullets = [
    `${summary.tasks} task${summary.tasks === 1 ? '' : 's'} across ${summary.features} feature${summary.features === 1 ? '' : 's'}`,
    `${summary.parallel_groups} parallel group${summary.parallel_groups === 1 ? '' : 's'}`,
    `Projected cost: $${summary.cost_total_usd.toFixed(2)}${summary.profile ? ` (${summary.profile} profile)` : ''}`,
    summary.council_warnings > 0
      ? `${summary.council_warnings} council warning${summary.council_warnings === 1 ? '' : 's'} flagged`
      : 'No council warnings',
  ];

  return [
    'Wave 2 plan ready. Review before Wave 3 starts:',
    '',
    ...bullets.map(b => '  • ' + b),
    '',
    'Options:',
    '  [ENTER / Y / go]   Proceed to Wave 3',
    '  [R / replan]       Replan (return to Wave 2)',
    '  [X / abort]        Stop the pipeline',
  ].join('\n');
}

export function parseResponse(answer, { defaultDecision = 'go' } = {}) {
  if (answer === undefined || answer === null) return defaultDecision;
  const raw = String(answer).trim().toLowerCase();
  if (raw === '') return defaultDecision;
  if (['go', 'y', 'yes', 'ok', 'proceed', 'continue', 'enter', '\n'].includes(raw)) return 'go';
  if (['r', 'replan', 'redo', 'plan'].includes(raw)) return 'replan';
  if (['x', 'abort', 'stop', 'cancel', 'quit', 'n', 'no'].includes(raw)) return 'abort';
  return defaultDecision;
}

export function isNonInteractive() {
  if (process.env.ORCHESTRE_NO_GATE === '1') return true;
  if (process.env.CI) return true;
  if (process.stdin && process.stdin.isTTY === false) return true;
  return false;
}

export function evaluate(projectRoot, plan, { answer, defaultDecision = 'go', nonInteractive } = {}) {
  const summary = summarizePlan(plan);
  if (!summary.valid) {
    const decision = 'abort';
    try { append(projectRoot, { type: 'plan_gate_decision', wave: 2, data: { decision, reason: summary.reason, summary } }); } catch {}
    return { decision, summary, prompt: renderPrompt(summary) };
  }

  const nonInter = nonInteractive === undefined ? isNonInteractive() : nonInteractive;
  const decision = nonInter ? defaultDecision : parseResponse(answer, { defaultDecision });

  try {
    append(projectRoot, {
      type: 'plan_gate_decision',
      wave: 2,
      data: { decision, answer: answer ?? null, non_interactive: nonInter, summary },
    });
  } catch {}

  return { decision, summary, prompt: renderPrompt(summary), nonInteractive: nonInter };
}
