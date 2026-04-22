#!/usr/bin/env node
/**
 * Orchestre Runtime Demo — runs without an LLM, without a network, without secrets.
 * Proves that Phase 1-5 runtime primitives compose end-to-end.
 *
 * Usage: node demo.mjs
 */
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

// Import runtime modules directly from the repo (no npm install)
const { init, append, read, snapshot }       = await import(`file://${repoRoot}/core/runtime/state-store.mjs`);
const { record, totalSoFar }                 = await import(`file://${repoRoot}/core/runtime/cost-tracker.mjs`);
const { recordTurn, assertTurnBudget }       = await import(`file://${repoRoot}/core/runtime/turn-loop.mjs`);
const { contextFor, decide, DEFAULT_CONTEXTS } = await import(`file://${repoRoot}/core/runtime/permission-context.mjs`);
const { evaluate: evaluatePlanGate }         = await import(`file://${repoRoot}/core/runtime/plan-gate.mjs`);
const { recordRejection, updateLearnedPatternsFile } = await import(`file://${repoRoot}/core/runtime/memory.mjs`);

// --- setup ----------------------------------------------------------------

const project = mkdtempSync(join(tmpdir(), 'orchestre-demo-'));
init(project);
process.env.ORCHESTRE_NO_GATE = '1'; // auto-approve plan gate for non-interactive demo

function log(msg, ...rest) { console.log(msg, ...rest); }
function rule() { console.log('─'.repeat(60)); }
function usd(n) { return '$' + n.toFixed(3); }

// --- helpers --------------------------------------------------------------

function startWave(wave) { append(project, { type: 'wave_start', wave }); }
function endWave(wave)   { append(project, { type: 'wave_end', wave, data: { stop_reason: 'completed' } }); }

function simulateTurn({ wave, tokens_in, tokens_out, model = 'claude-sonnet-4-6' }) {
  // Before every turn, assert we're still within turn-loop limits.
  assertTurnBudget(project, wave);
  record(project, { wave, model, tokens_in, tokens_out });
  recordTurn(project, { wave });
}

function checkPermission(wave, toolName, filePath = null) {
  const ctx = contextFor(wave, DEFAULT_CONTEXTS);
  return decide({ context: ctx, toolName, filePath });
}

// --- pipeline -------------------------------------------------------------

rule();
log('Orchestre Runtime Demo — Wave 0 → Wave 4');
log('project root (ephemeral):', project);
rule();

// Wave 0 — Lint (read-only). Permission gate: Read OK, Write blocked.
startWave(0);
const r0a = checkPermission(0, 'Read');
const r0b = checkPermission(0, 'Write', 'app/page.tsx');
log(`  Wave 0 permission — Read: ${r0a.allowed ? '✓' : '✗'}, Write: ${r0b.allowed ? '✓' : '✗'} (${r0b.rule || 'allowed'})`);
simulateTurn({ wave: 0, tokens_in: 2500, tokens_out: 1200 });
endWave(0);
log(`✔ Wave 0 completed — 1 turn, ~${usd(totalSoFar(project).usd)}`);
rule();

// Wave 1 — Decompose (2 turns, opus).
startWave(1);
simulateTurn({ wave: 1, tokens_in: 5000, tokens_out: 3000, model: 'claude-opus-4-6' });
simulateTurn({ wave: 1, tokens_in: 8000, tokens_out: 5000, model: 'claude-opus-4-6' });
endWave(1);
log(`✔ Wave 1 completed — 2 turns, ~${usd(totalSoFar(project).usd)}`);
rule();

// Wave 2 — Plan + gate checkpoint.
startWave(2);
simulateTurn({ wave: 2, tokens_in: 4000, tokens_out: 2500, model: 'claude-opus-4-6' });

const mockPlan = {
  version: '2.0.0',
  project_id: 'runtime-demo',
  tasks: [
    { task_id: 'T001', feature_id: 'F01', parallel_group: 1, order: 1 },
    { task_id: 'T002', feature_id: 'F01', parallel_group: 1, order: 2 },
    { task_id: 'T003', feature_id: 'F02', parallel_group: 2, order: 3 },
  ],
  cost_estimate: { total_usd: 0.5, per_feature: { F01: 0.3, F02: 0.2 }, profile: 'balanced' },
  council_checks: { warnings: [] },
};

const gate = evaluatePlanGate(project, mockPlan);
endWave(2);
log(`✔ Wave 2 completed — plan gate: ${gate.decision}`);
rule();

// Wave 3 — Generate (3 feature turns).
startWave(3);
simulateTurn({ wave: 3, tokens_in: 6000, tokens_out: 8000 });
simulateTurn({ wave: 3, tokens_in: 6000, tokens_out: 8000 });
simulateTurn({ wave: 3, tokens_in: 6000, tokens_out: 8000 });
endWave(3);
log(`✔ Wave 3 completed — 3 turns, ~${usd(totalSoFar(project).usd)}`);
rule();

// Wave 4 — Audit. Record 3 rejections of the same pattern → triggers learned pattern.
startWave(4);
simulateTurn({ wave: 4, tokens_in: 3000, tokens_out: 1500 });
for (let i = 0; i < 3; i++) {
  recordRejection(project, {
    pattern: 'any-type-in-api',
    context: `app/api/route-${i}.ts`,
    reason: 'use unknown + type narrowing or z.infer from a Zod schema',
    wave: 4,
  });
}
const learnedResult = updateLearnedPatternsFile(repoRoot, project, { threshold: 3, filePath: join(project, 'core', 'memory', 'learned-patterns.md') });
endWave(4);
log(`✔ Wave 4 completed — ${learnedResult.count} learned pattern(s) recorded`);
log(`→ Learned pattern written to ${learnedResult.path}`);
rule();

// --- summary --------------------------------------------------------------

const finalSnap = snapshot(project);
const events = read(project);
const t = totalSoFar(project);

log(`\nTotal cost:   ${usd(t.usd)}`);
log(`Total turns:  ${finalSnap.turnCount}`);
log(`Total events: ${events.length}`);
log(`Events log:   ${join(project, '.orchestre', 'state', 'events.jsonl')}`);
log(`Snapshot:     ${join(project, '.orchestre', 'state', 'snapshot.json')}`);

if (existsSync(learnedResult.path)) {
  log(`\nLearned pattern file (head):`);
  const md = readFileSync(learnedResult.path, 'utf8');
  log(md.split('\n').slice(0, 12).map(l => '  ' + l).join('\n'));
}

rule();
log('Demo complete. Open tools/dashboard.html and load the events.jsonl file above to see a visual timeline.');
