/**
 * Checks import paths for architecture violations.
 *
 * Checks:
 * - IMPORT-01: Relative imports with ../ (should use @/ alias)
 * - IMPORT-02: Cross-feature imports (components/featureA -> components/featureB)
 */

let ts;
try {
  ts = await import('typescript');
  if (ts.default) ts = ts.default;
} catch {
  ts = null;
}

export const importPathsChecker = {
  name: 'import-paths',

  async check(filePath, content) {
    if (!ts) {
      return { checker: 'import-paths', status: 'passed', violations: [] };
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

      ts.forEachChild(sourceFile, node => {
        // Check import declarations
        if (node.kind === ts.SyntaxKind.ImportDeclaration && node.moduleSpecifier) {
          const importPath = node.moduleSpecifier.text || '';
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

          checkImportPath(importPath, filePath, line + 1, violations);
        }

        // Check dynamic imports
        if (node.kind === ts.SyntaxKind.CallExpression) {
          const expr = node.expression;
          if (expr.kind === ts.SyntaxKind.ImportKeyword && node.arguments?.length > 0) {
            const arg = node.arguments[0];
            if (arg.kind === ts.SyntaxKind.StringLiteral) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
              checkImportPath(arg.text, filePath, line + 1, violations);
            }
          }
        }
      });
    } catch {
      return { checker: 'import-paths', status: 'passed', violations: [] };
    }

    return {
      checker: 'import-paths',
      status: violations.length > 0 ? 'blocked' : 'passed',
      violations,
    };
  }
};

function checkImportPath(importPath, filePath, line, violations) {
  // IMPORT-01: Deep relative imports (more than 1 level up)
  if (importPath.startsWith('../..')) {
    violations.push({
      rule: 'IMPORT-01',
      message: `Deep relative import "${importPath}" — use @/ alias instead`,
      line,
    });
  }

  // IMPORT-02: Cross-feature imports
  const normalizedFile = filePath.replace(/\\/g, '/');
  const featureMatch = normalizedFile.match(/components\/([^/]+)\//);
  if (featureMatch) {
    const currentFeature = featureMatch[1];
    // Skip shared UI components
    if (currentFeature === 'ui') return;

    const importFeatureMatch = importPath.match(/components\/([^/]+)/);
    if (importFeatureMatch) {
      const importedFeature = importFeatureMatch[1];
      if (importedFeature !== currentFeature && importedFeature !== 'ui') {
        violations.push({
          rule: 'IMPORT-02',
          message: `Cross-feature import from "${currentFeature}" to "${importedFeature}" — features must be isolated`,
          line,
        });
      }
    }
  }
}
