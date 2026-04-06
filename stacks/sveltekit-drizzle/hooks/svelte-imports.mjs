/**
 * Checks import paths for SvelteKit architecture violations.
 *
 * Checks:
 * - IMPORT-01: Deep relative imports with ../../ (should use $lib/ alias)
 * - IMPORT-02: Cross-feature imports (components/featureA -> components/featureB)
 * - IMPORT-03: Server imports from client code ($lib/server/ imported in .svelte or client files)
 */

let ts;
try {
  ts = await import('typescript');
  if (ts.default) ts = ts.default;
} catch {
  ts = null;
}

export const svelteImportsChecker = {
  name: 'svelte-imports',

  async check(filePath, content) {
    if (!ts) {
      return { checker: 'svelte-imports', status: 'passed', violations: [] };
    }

    // For .svelte files, extract the <script> block only
    let scriptContent = content;
    if (filePath.endsWith('.svelte')) {
      const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
      if (!scriptMatch) {
        return { checker: 'svelte-imports', status: 'passed', violations: [] };
      }
      scriptContent = scriptMatch[1];
    }

    const violations = [];

    try {
      const sourceFile = ts.createSourceFile(
        filePath.replace('.svelte', '.ts'),
        scriptContent,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );

      ts.forEachChild(sourceFile, node => {
        if (node.kind === ts.SyntaxKind.ImportDeclaration && node.moduleSpecifier) {
          const importPath = node.moduleSpecifier.text || '';
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          checkImportPath(importPath, filePath, line + 1, violations);
        }

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
      return { checker: 'svelte-imports', status: 'passed', violations: [] };
    }

    return {
      checker: 'svelte-imports',
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
      message: `Deep relative import "${importPath}" — use $lib/ alias instead`,
      line,
    });
  }

  // IMPORT-02: Cross-feature imports
  const normalizedFile = filePath.replace(/\\/g, '/');
  const featureMatch = normalizedFile.match(/components\/([^/]+)\//);
  if (featureMatch) {
    const currentFeature = featureMatch[1];
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

  // IMPORT-03: Server imports from client code
  // .svelte files and files NOT in src/routes/**/+page.server.ts should not import $lib/server/
  if (importPath.includes('$lib/server') || importPath.includes('lib/server')) {
    const isServerFile = /\+(page|layout)\.server\.(ts|js)$/.test(normalizedFile) ||
                         /\+server\.(ts|js)$/.test(normalizedFile) ||
                         /hooks\.server\.(ts|js)$/.test(normalizedFile) ||
                         /lib\/server\//.test(normalizedFile);
    if (!isServerFile) {
      violations.push({
        rule: 'IMPORT-03',
        message: `Server import "${importPath}" in client code — server modules can only be imported in +page.server.ts, +server.ts, or hooks.server.ts`,
        line,
      });
    }
  }
}
