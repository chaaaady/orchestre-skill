/**
 * Detects secrets and sensitive data in code.
 * Regex-based — this is the right tool for pattern matching on secrets.
 */
export const secretsChecker = {
  name: 'secrets',

  async check(filePath, content) {
    const violations = [];
    const lines = content.split('\n');

    const patterns = [
      { rule: 'SECRET-01', regex: /sk_(live|test)_[a-zA-Z0-9]{20,}/, message: 'Stripe secret key detected' },
      { rule: 'SECRET-02', regex: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/, message: 'JWT token detected' },
      { rule: 'SECRET-03', regex: /ghp_[a-zA-Z0-9]{36}/, message: 'GitHub PAT detected' },
      { rule: 'SECRET-04', regex: /AKIA[A-Z0-9]{16}/, message: 'AWS access key detected' },
      { rule: 'SECRET-05', regex: /(password|secret|token|api_key)\s*[:=]\s*['"][^'"]{8,}['"]/i, message: 'Hardcoded secret detected' },
      { rule: 'SECRET-06', regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, message: 'Private key detected' },
      { rule: 'SECRET-07', regex: /mongodb(\+srv)?:\/\/[^/\s]+:[^@/\s]+@/, message: 'Database connection string with credentials' },
      { rule: 'SECRET-08', regex: /postgres(ql)?:\/\/[^/\s]+:[^@/\s]+@/, message: 'Database connection string with credentials' },
    ];

    // Check for NEXT_PUBLIC_ on secret variable names
    const secretVarPattern = /NEXT_PUBLIC_(STRIPE_SECRET|SUPABASE_SERVICE_ROLE|.*_SECRET_KEY|.*_API_KEY(?!.*ANON))/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

      for (const { rule, regex, message } of patterns) {
        if (regex.test(line)) {
          violations.push({ rule, message, line: i + 1 });
        }
      }

      if (secretVarPattern.test(line)) {
        violations.push({ rule: 'SECRET-09', message: 'NEXT_PUBLIC_ prefix on secret variable', line: i + 1 });
      }

      // Sensitive console.log detection
      if (/console\.(log|info|debug|warn)\s*\(/.test(line)) {
        if (/\b(password|token|secret|apiKey|api_key|authorization|cookie|session)\b/i.test(line)) {
          violations.push({ rule: 'SECRET-10', message: 'Sensitive data in console.log', line: i + 1 });
        }
      }
    }

    return {
      checker: 'secrets',
      status: violations.length > 0 ? 'blocked' : 'passed',
      violations,
    };
  }
};
