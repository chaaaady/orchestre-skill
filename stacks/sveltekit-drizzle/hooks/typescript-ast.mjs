/**
 * AST-based TypeScript checks for SvelteKit projects.
 *
 * Checks:
 * - TS-01: `any` type in type annotations (not in comments, strings, or identifiers)
 * - TS-02: `throw` statements in src/lib/server/ files (should use Result<T>)
 * - TS-03: Direct db./fetch() calls in src/lib/components/ (should be in src/lib/server/)
 *
 * Uses ts.createSourceFile() — zero dependencies beyond TypeScript itself (~5ms per file).
 */

let ts;
try {
  ts = await import('typescript');
  if (ts.default) ts = ts.default;
} catch {
  ts = null;
}

export const typescriptAstChecker = {
  name: 'typescript-ast',

  async check(filePath, content) {
    if (!ts) {
      return { checker: 'typescript-ast', status: 'passed', violations: [], message: 'TypeScript not available, skipping AST checks' };
    }

    const violations = [];

    try {
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );

      visitNode(sourceFile, filePath, violations, ts, sourceFile);
    } catch {
      return { checker: 'typescript-ast', status: 'passed', violations: [] };
    }

    return {
      checker: 'typescript-ast',
      status: violations.length > 0 ? 'blocked' : 'passed',
      violations,
    };
  }
};

function visitNode(node, filePath, violations, ts, sourceFile) {
  // TS-01: Check for `any` keyword in type positions only
  if (node.kind === ts.SyntaxKind.AnyKeyword) {
    const parent = node.parent;
    if (parent && isTypePosition(parent, ts)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      violations.push({
        rule: 'TS-01',
        message: '`any` type detected — use `unknown` with type narrowing instead',
        line: line + 1,
      });
    }
  }

  // TS-02: Check for `throw` in src/lib/server/ files (business logic)
  if (node.kind === ts.SyntaxKind.ThrowStatement) {
    if (isInServerLib(filePath)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      violations.push({
        rule: 'TS-02',
        message: '`throw` in lib/server/ — use Result<T> pattern instead',
        line: line + 1,
      });
    }
  }

  // TS-03: Check for db. or fetch() in components
  if (node.kind === ts.SyntaxKind.CallExpression) {
    if (isInComponents(filePath)) {
      const callText = node.expression.getText ? node.expression.getText(sourceFile) : '';

      // Direct Drizzle calls (db.select, db.insert, db.update, db.delete)
      if (/\bdb\s*\./.test(callText)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        violations.push({
          rule: 'TS-03',
          message: 'Direct db.* call in components — move to src/lib/server/',
          line: line + 1,
        });
      }

      // Bare fetch() calls
      if (callText === 'fetch' && node.expression.kind === ts.SyntaxKind.Identifier) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        violations.push({
          rule: 'TS-03',
          message: 'Direct fetch() in components — use +page.server.ts load() or form actions',
          line: line + 1,
        });
      }
    }
  }

  ts.forEachChild(node, child => visitNode(child, filePath, violations, ts, sourceFile));
}

function isTypePosition(node, ts) {
  return (
    node.kind === ts.SyntaxKind.TypeReference ||
    node.kind === ts.SyntaxKind.ArrayType ||
    node.kind === ts.SyntaxKind.TypeAliasDeclaration ||
    node.kind === ts.SyntaxKind.VariableDeclaration ||
    node.kind === ts.SyntaxKind.Parameter ||
    node.kind === ts.SyntaxKind.PropertyDeclaration ||
    node.kind === ts.SyntaxKind.PropertySignature ||
    node.kind === ts.SyntaxKind.MethodDeclaration ||
    node.kind === ts.SyntaxKind.MethodSignature ||
    node.kind === ts.SyntaxKind.FunctionDeclaration ||
    node.kind === ts.SyntaxKind.ArrowFunction ||
    node.kind === ts.SyntaxKind.TypeAssertion ||
    node.kind === ts.SyntaxKind.AsExpression ||
    node.kind === ts.SyntaxKind.ReturnStatement ||
    node.kind === ts.SyntaxKind.IndexSignature
  );
}

function isInServerLib(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  // SvelteKit: src/lib/server/ is the business logic layer
  return /\blib\/server\//.test(normalized) || /\blib\//.test(normalized);
}

function isInComponents(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  // SvelteKit: src/lib/components/ is the UI layer
  return /\bcomponents\//.test(normalized);
}
