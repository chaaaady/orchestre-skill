/**
 * Mutation Score guard — replaces the fuzzy "score /100" with a real signal.
 *
 * Wave 4 auditor scores code by architecture + pattern compliance, but a high
 * score can still hide weak tests. Mutation testing flips that: it changes bits
 * of the code under test and checks whether tests catch the mutation. If tests
 * pass on a mutated version, they don't catch that bug class.
 *
 * This module is a harness around stryker-js (not a dependency — stryker must
 * be installed in the target project when used). We parse its JSON report and
 * enforce thresholds per task category.
 *
 * Defaults follow the audit recommendation:
 *   - critical paths (auth, billing, webhook, crypto) → ≥ 70 %
 *   - standard paths                                   → ≥ 50 %
 *   - experimental/prototype paths                     → ≥ 30 %
 *
 * Stryker JSON report shape (simplified):
 *   {
 *     mutationScore: 82.5,
 *     mutationScoreBasedOnCoveredCode: 90.0,
 *     thresholds: {...},
 *     files: {
 *       "src/auth.ts": { mutants: [{status: "Killed"|"Survived"|"Timeout"|"NoCoverage"|"CompileError", ...}] }
 *     }
 *   }
 */
import { existsSync, readFileSync } from 'node:fs';

import { append } from './state-store.mjs';

export const DEFAULT_THRESHOLDS = Object.freeze({
  critical: 70,
  standard: 50,
  experimental: 30,
});

const CRITICAL_PATH_MATCHERS = [
  /\b(auth|session|login|logout|signup|signin|register)\b/i,
  /\b(billing|payment|checkout|subscription|invoice)\b/i,
  /\b(webhook|stripe|oauth|csrf)\b/i,
  /\b(crypto|encrypt|decrypt|sign|verify|hash)\b/i,
  /\b(rls|permission|admin|role)\b/i,
];

export class MutationScoreBelowThresholdError extends Error {
  constructor({ score, threshold, label, category }) {
    super(
      `Mutation score ${score.toFixed(1)}% < threshold ${threshold}% ` +
      `(${category}${label ? `, ${label}` : ''})`
    );
    this.name = 'MutationScoreBelowThresholdError';
    this.score = score;
    this.threshold = threshold;
    this.label = label || null;
    this.category = category;
  }
}

export function classifyPath(filePath) {
  if (!filePath) return 'standard';
  for (const re of CRITICAL_PATH_MATCHERS) {
    if (re.test(filePath)) return 'critical';
  }
  if (/\.(draft|experimental|sandbox)\./.test(filePath)) return 'experimental';
  return 'standard';
}

export function parseStrykerReport(rawOrPath) {
  let json;
  if (typeof rawOrPath === 'string' && existsSync(rawOrPath)) {
    json = JSON.parse(readFileSync(rawOrPath, 'utf8'));
  } else if (typeof rawOrPath === 'string') {
    json = JSON.parse(rawOrPath);
  } else {
    json = rawOrPath;
  }

  if (!json || typeof json !== 'object') {
    return { valid: false, reason: 'report is not an object' };
  }

  const score = Number(json.mutationScore);
  const scoreCovered = Number(json.mutationScoreBasedOnCoveredCode);

  const perFile = {};
  let killed = 0, survived = 0, timeout = 0, noCoverage = 0, compileError = 0;

  const files = json.files || {};
  for (const [path, data] of Object.entries(files)) {
    const mutants = Array.isArray(data.mutants) ? data.mutants : [];
    const fileCounts = { killed: 0, survived: 0, timeout: 0, noCoverage: 0, compileError: 0 };
    for (const m of mutants) {
      switch (m.status) {
        case 'Killed':       killed++; fileCounts.killed++; break;
        case 'Survived':     survived++; fileCounts.survived++; break;
        case 'Timeout':      timeout++; fileCounts.timeout++; break;
        case 'NoCoverage':   noCoverage++; fileCounts.noCoverage++; break;
        case 'CompileError': compileError++; fileCounts.compileError++; break;
      }
    }
    const total = fileCounts.killed + fileCounts.survived + fileCounts.timeout;
    perFile[path] = {
      ...fileCounts,
      mutationScore: total === 0 ? null : (fileCounts.killed + fileCounts.timeout) / total * 100,
      category: classifyPath(path),
    };
  }

  return {
    valid: true,
    mutationScore: Number.isFinite(score) ? score : null,
    mutationScoreBasedOnCoveredCode: Number.isFinite(scoreCovered) ? scoreCovered : null,
    totals: { killed, survived, timeout, noCoverage, compileError },
    files: perFile,
  };
}

export function assertMutationScore(report, { thresholds = DEFAULT_THRESHOLDS, projectRoot, label, wave } = {}) {
  if (!report || !report.valid) {
    throw new TypeError('assertMutationScore: invalid report');
  }

  const failures = [];
  for (const [path, f] of Object.entries(report.files)) {
    if (f.mutationScore === null) continue; // no mutants (skipped file)
    const threshold = thresholds[f.category] ?? thresholds.standard;
    if (f.mutationScore < threshold) {
      failures.push({ path, score: f.mutationScore, threshold, category: f.category });
    }
  }

  if (failures.length === 0) {
    if (projectRoot) {
      try {
        append(projectRoot, {
          type: 'mutation_score_pass',
          wave: typeof wave === 'number' ? wave : null,
          data: { label: label || null, score: report.mutationScore, files: Object.keys(report.files).length },
        });
      } catch {}
    }
    return { passed: true, score: report.mutationScore, failures: [] };
  }

  if (projectRoot) {
    try {
      append(projectRoot, {
        type: 'mutation_score_fail',
        wave: typeof wave === 'number' ? wave : null,
        data: { label: label || null, score: report.mutationScore, failures, thresholds },
      });
    } catch {}
  }

  const worst = failures.reduce((a, b) => (a.score <= b.score ? a : b));
  throw new MutationScoreBelowThresholdError({
    score: worst.score,
    threshold: worst.threshold,
    label: `${worst.path} (+${failures.length - 1} more)` + (label ? ` — ${label}` : ''),
    category: worst.category,
  });
}

export function summary(report) {
  if (!report || !report.valid) return { valid: false };
  const t = report.totals;
  const total = t.killed + t.survived + t.timeout;
  const byCategory = { critical: [], standard: [], experimental: [] };
  for (const [path, f] of Object.entries(report.files)) {
    byCategory[f.category].push({ path, score: f.mutationScore });
  }
  return {
    valid: true,
    overallScore: report.mutationScore,
    files_checked: Object.keys(report.files).length,
    mutants_total: total,
    killed_ratio: total === 0 ? null : (t.killed + t.timeout) / total * 100,
    by_category: byCategory,
  };
}
