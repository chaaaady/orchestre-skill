/**
 * Detects hardcoded Tailwind color classes.
 * Enforces semantic tokens only (bg-primary, text-destructive, etc.)
 * Regex-based — appropriate for CSS class pattern matching.
 */

// Tailwind color classes that should be replaced with semantic tokens
const COLOR_REGEX = /\b(bg|text|border|ring|outline|shadow|accent|fill|stroke|from|via|to|decoration|divide|placeholder)-(red|blue|green|yellow|orange|purple|pink|indigo|cyan|teal|emerald|violet|fuchsia|rose|amber|lime|sky|slate|gray|zinc|neutral|stone|warmGray|trueGray|coolGray|blueGray)-\d{1,3}\b/g;

// Allowed exceptions
const ALLOWED = new Set(['transparent', 'white', 'black', 'current', 'inherit']);

export const tailwindTokensChecker = {
  name: 'tailwind-tokens',

  async check(filePath, content) {
    const violations = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments and non-JSX/className lines for efficiency
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

      let match;
      COLOR_REGEX.lastIndex = 0;
      while ((match = COLOR_REGEX.exec(line)) !== null) {
        const token = match[0];
        const colorName = match[2];
        if (!ALLOWED.has(colorName)) {
          violations.push({
            rule: 'DESIGN-01',
            message: `Hardcoded color "${token}" — use semantic token (e.g., bg-primary, text-destructive)`,
            line: i + 1,
          });
        }
      }
    }

    return {
      checker: 'tailwind-tokens',
      status: violations.length > 0 ? 'blocked' : 'passed',
      violations,
    };
  }
};
