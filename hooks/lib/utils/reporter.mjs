/**
 * Structured reporting for hook results.
 * Outputs human-readable messages to stderr (shown to user).
 */
export function report({ status, results, filePath }) {
  const icon = status === 'blocked' ? '\u{1F6AB}' : '\u{26A0}\u{FE0F}';
  const label = status === 'blocked' ? 'BLOCKED' : 'WARNING';

  const lines = [`${icon} Orchestre Guard — ${label}: ${filePath}`];

  for (const result of results) {
    if (result.violations) {
      for (const v of result.violations) {
        lines.push(`   ${v.rule || result.checker}: ${v.message}${v.line ? ` (line ${v.line})` : ''}`);
      }
    } else {
      lines.push(`   ${result.checker}: ${result.message}`);
    }
  }

  if (status === 'blocked') {
    lines.push('', '   Fix the violations above and retry.');
  }

  process.stderr.write(lines.join('\n') + '\n');
}
