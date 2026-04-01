/**
 * Maps hook modes and file extensions to appropriate checkers.
 */
import { secretsChecker } from './checkers/secrets.mjs';
import { tailwindTokensChecker } from './checkers/tailwind-tokens.mjs';
import { typescriptAstChecker } from './checkers/typescript-ast.mjs';
import { importPathsChecker } from './checkers/import-paths.mjs';

const CHECKER_MAP = {
  'pre-write': {
    ts: [secretsChecker, tailwindTokensChecker, typescriptAstChecker, importPathsChecker],
    tsx: [secretsChecker, tailwindTokensChecker, typescriptAstChecker, importPathsChecker],
    js: [secretsChecker, tailwindTokensChecker],
    jsx: [secretsChecker, tailwindTokensChecker],
    mjs: [secretsChecker],
    cjs: [secretsChecker],
  },
  'post-write': {
    // Post-write is lighter — just warnings, no blocking
    ts: [],
    tsx: [],
  },
  'pre-commit': {
    ts: [secretsChecker],
    tsx: [secretsChecker],
    js: [secretsChecker],
    jsx: [secretsChecker],
    mjs: [secretsChecker],
    cjs: [secretsChecker],
    env: [secretsChecker],
  },
};

export function getCheckers(mode, filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.') + 1);
  const modeMap = CHECKER_MAP[mode] || CHECKER_MAP['pre-write'];
  return modeMap[ext] || [];
}
