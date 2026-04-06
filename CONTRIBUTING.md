# Contributing to Orchestre

Thanks for your interest in Orchestre! Here's how to contribute.

## Adding a New Stack

This is the most impactful contribution. A stack = a complete set of rules, hooks, knowledge, and templates for a specific tech combination.

### Structure

Create a directory in `stacks/`:

```
stacks/your-stack/
├── stack.json              # Required — stack configuration
├── CLAUDE.stack.md         # Required — stack rules for CLAUDE.md
├── rules/
│   ├── typescript.md       # (or python.md, etc.)
│   └── security.md
├── hooks/
│   ├── tailwind-tokens.mjs # If using Tailwind
│   └── your-checker.mjs    # Custom AST checkers
├── knowledge/
│   ├── auth-patterns.md    # Auth patterns for this stack
│   ├── forms-patterns.md   # Form handling patterns
│   └── ...                 # More production patterns
├── templates/
│   ├── auth-form.*         # Starter auth component
│   ├── webhook-handler.*   # Webhook boilerplate
│   └── ...
└── env-templates/
    └── your-stack.env.example
```

### stack.json Format

```json
{
  "id": "your-stack",
  "name": "Framework + DB + Styling + Payment",
  "extends": "_base",
  "language": "typescript",
  "rules": {
    "R6": {
      "id": "R6",
      "description": "Your stack's data loading rule",
      "scope": ["src/"],
      "enabled": true,
      "universal": false
    },
    "R7": {
      "id": "R7",
      "description": "Your stack's mutation rule",
      "scope": ["src/"],
      "enabled": true,
      "universal": false
    }
  },
  "hooks": {
    "checkers": {
      "tailwind-tokens": true,
      "your-custom-checker": true
    }
  },
  "singletons": {},
  "folder_structure": {},
  "knowledge_base": [],
  "defaults": {
    "tech_stack": {}
  }
}
```

### Writing a Hook Checker

Checkers are ESM modules that export an object with a `check()` method:

```javascript
export const myChecker = {
  name: 'my-checker',
  async check(filePath, content) {
    const violations = [];
    // Your detection logic here
    return {
      checker: 'my-checker',
      status: violations.length > 0 ? 'blocked' : 'passed',
      violations,
    };
  }
};
```

Each violation has: `{ rule: 'CODE-01', message: 'description', line: 42 }`.

### Writing Knowledge Files

Knowledge files are markdown with production-ready code examples. They should:
- Cover the **full lifecycle**, not just happy path
- Include **anti-patterns** (what NOT to do)
- Use **Result<T>** pattern for error handling
- Follow the stack's conventions (import aliases, file locations)
- Be **self-contained** — a developer should be able to copy-paste and adapt

## Improving Existing Stacks

- Fix incorrect patterns in knowledge files
- Add missing edge cases to templates
- Improve hook checker accuracy (fewer false positives)
- Add new knowledge files for common libraries

## Core Improvements

- Better guard prompts (over-engineering, breakage, etc.)
- New contract schemas
- Infrastructure improvements (cost tracking, session store)
- Test coverage

## Running Tests

```bash
npm test
```

All 135+ tests must pass before submitting a PR.

## Style

- Keep knowledge files **code-heavy** — patterns, not prose
- Use semantic tokens, never hardcoded colors
- Follow the Result<T> pattern for error handling examples
- Use the stack's import alias convention

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
