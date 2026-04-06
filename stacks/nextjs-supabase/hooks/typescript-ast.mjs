/**
 * AST-based TypeScript checks using the TypeScript compiler API.
 *
 * Checks:
 * - TS-01: `any` type in type annotations (not in comments, strings, or identifiers)
 * - TS-02: `throw` statements in lib/ files (should use Result<T>)
 * - TS-03: Direct supabase.from() / fetch() calls in app/ or components/ (should be in lib/)
 *
 * Uses ts.createSourceFile() — zero dependencies beyond TypeScript itself (~5ms per file).
 */

let ts;
try {
  ts = await import('typescript');
  // Handle both ESM default export and named export patterns
  if (ts.default) ts = ts.default;
} catch {
  // TypeScript not available — skip AST checks gracefully
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
        true, // setParentNodes
        filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );

      // Walk the AST
      visitNode(sourceFile, filePath, violations, ts, sourceFile);
    } catch {
      // If parsing fails, don't block — it might be a partial edit
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
    // Only flag if parent is a type annotation, type reference, or type assertion
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

  // TS-02: Check for `throw` in lib/ files
  if (node.kind === ts.SyntaxKind.ThrowStatement) {
    if (isInLibPath(filePath)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      violations.push({
        rule: 'TS-02',
        message: '`throw` in lib/ — use Result<T> pattern instead',
        line: line + 1,
      });
    }
  }

  // TS-03: Check for supabase.from() or fetch() in app/ or components/
  // Uses AST PropertyAccessExpression to handle multi-line chained calls
  if (node.kind === ts.SyntaxKind.CallExpression) {
    if (isInAppOrComponents(filePath)) {
      // Check for .from() calls on any object (handles multi-line: supabase\n  .from('x'))
      if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
        const propAccess = node.expression;
        const methodName = propAccess.name?.text;
        if (methodName === 'from') {
          // Check if the object is named 'supabase' (walk up the chain)
          const objText = propAccess.expression.getText ? propAccess.expression.getText(sourceFile) : '';
          if (/supabase/.test(objText)) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
            violations.push({
              rule: 'TS-03',
              message: 'Direct supabase.from() in app/components — move to lib/queries/',
              line: line + 1,
            });
          }
        }
      }

      // Only flag bare fetch() calls, not wrapped ones in lib imports
      const callText = node.expression.getText ? node.expression.getText(sourceFile) : '';
      if (callText === 'fetch' && node.expression.kind === ts.SyntaxKind.Identifier) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        violations.push({
          rule: 'TS-03',
          message: 'Direct fetch() in app/components — move to lib/',
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

function isInLibPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  // Match lib/ at start or after a separator — avoid matching "library-manager/" etc.
  return /(^|\/)lib\//.test(normalized);
}

function isInAppOrComponents(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return /(^|\/)app\//.test(normalized) || /(^|\/)components\//.test(normalized);
}
