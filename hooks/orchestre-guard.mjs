#!/usr/bin/env node
/**
 * Orchestre Guard — Unified hook entry point
 * Replaces: pre-write-guard.sh, post-write-check.sh, pre-commit-audit.sh
 *
 * Usage: node hooks/orchestre-guard.mjs --mode <pre-write|post-write|pre-commit>
 * Input: Reads $TOOL_INPUT from environment or stdin (JSON with file_path and content)
 */
import { parseHookInput } from './lib/utils/parse-hook-input.mjs';
import { report } from './lib/utils/reporter.mjs';
import { getCheckers } from './lib/checker-registry.mjs';

const TIMEOUT_MS = 3000;

async function runWithTimeout(fn, name) {
  return Promise.race([
    fn(),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Checker "${name}" timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS))
  ]).catch(err => ({ checker: name, status: 'warning', message: err.message, violations: [] }));
}

async function main() {
  const mode = process.argv.find((a, i) => process.argv[i - 1] === '--mode') || 'pre-write';

  let input;
  try {
    input = await parseHookInput();
  } catch (err) {
    // If we can't parse input, pass through (don't block on hook infrastructure failures)
    process.exit(0);
  }

  const { filePath, content } = input;
  if (!filePath || !content) {
    process.exit(0);
  }

  // Skip non-code files
  const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  if (!codeExtensions.includes(ext)) {
    process.exit(0);
  }

  const checkers = getCheckers(mode, filePath);
  const results = await Promise.all(
    checkers.map(checker => runWithTimeout(() => checker.check(filePath, content), checker.name))
  );

  const blocked = results.filter(r => r.status === 'blocked');
  const warnings = results.filter(r => r.status === 'warning');

  if (blocked.length > 0) {
    report({ status: 'blocked', results: blocked, filePath });
    process.exit(1);
  }

  if (warnings.length > 0) {
    report({ status: 'warning', results: warnings, filePath });
  }

  process.exit(0);
}

main().catch(() => process.exit(0)); // Never crash the hook
