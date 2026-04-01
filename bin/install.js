#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const target = process.argv[2] || '.';
const pkgDir = path.resolve(__dirname, '..');

console.log('🎵 Orchestre — Installing project assets');
console.log(`   Target: ${path.resolve(target)}\n`);

const copies = [
  { src: 'hooks', dest: 'hooks', label: 'hooks (pre-write, post-write, pre-commit)' },
  { src: 'fixed-assets', dest: 'fixed-assets', label: 'library templates (18 patterns)' },
  { src: 'knowledge-base', dest: 'knowledge-base', label: 'knowledge base (SQL, design, components)' },
  { src: 'contracts', dest: 'contracts', label: 'contracts (7 JSON schemas)' },
  { src: 'profiles', dest: 'profiles', label: 'profiles (premium, balanced, budget)' },
];

for (const { src, dest, label } of copies) {
  const srcPath = path.join(pkgDir, src);
  const destPath = path.join(target, dest);
  if (fs.existsSync(srcPath)) {
    execSync(`cp -r "${srcPath}" "${destPath}"`, { stdio: 'inherit' });
    console.log(`   ✓ ${label}`);
  }
}

// Make hooks executable
const hooksDir = path.join(target, 'hooks');
if (fs.existsSync(hooksDir)) {
  execSync(`chmod +x "${hooksDir}"/*.sh 2>/dev/null || true`);
}

// Add .orchestre/ to .gitignore
const gitignore = path.join(target, '.gitignore');
if (fs.existsSync(gitignore)) {
  const content = fs.readFileSync(gitignore, 'utf8');
  if (!content.includes('.orchestre/')) {
    fs.appendFileSync(gitignore, '\n# Orchestre\n.orchestre/\n');
    console.log('   ✓ .gitignore updated');
  }
}

console.log(`
✅ Project assets installed!

Global (already active — installed in ~/.claude/):
  • CLAUDE.md — architecture rules R1-R8
  • 7 agents — wave pipeline
  • 3 skills — /orchestre-go, /orchestre-audit, /orchestre-status
  • 2 rules — typescript, security

Project (just installed):
  • hooks/ — real-time guardrails
  • fixed-assets/ — 18 library templates
  • knowledge-base/ — SQL, design, components
  • contracts/ — JSON schemas
  • profiles/ — quality/cost configs

Usage:
  claude                              → rules active automatically
  /orchestre-go "mon projet"          → generate full project
  /orchestre-audit                    → audit code /100
`);
