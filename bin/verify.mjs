#!/usr/bin/env node
/**
 * Orchestre Verify — checks that installation is working correctly.
 *
 * Usage: node bin/verify.mjs [target-dir]
 *        npm run verify
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(process.argv[2] || '.');

let passed = 0;
let failed = 0;
let warnings = 0;

function check(name, condition, hint) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    if (hint) console.log(`    → ${hint}`);
    failed++;
  }
}

function warn(name, condition, hint) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } else {
    console.log(`  \x1b[33m⚠\x1b[0m ${name}`);
    if (hint) console.log(`    → ${hint}`);
    warnings++;
  }
}

console.log('\nOrchestre — Installation Verification\n');
console.log(`Target: ${target}\n`);

// --- Core files ---
console.log('Core files:');
check('CLAUDE.md exists', existsSync(join(target, 'CLAUDE.md')), 'Run: npx orchestre init');
check('core/hooks/orchestre-guard.mjs exists', existsSync(join(target, 'core', 'hooks', 'orchestre-guard.mjs')), 'Run: npx orchestre init');
check('core/CLAUDE.base.md exists', existsSync(join(target, 'core', 'CLAUDE.base.md')));
check('core/contracts/ exists', existsSync(join(target, 'core', 'contracts')));

// --- Settings ---
console.log('\nHook configuration:');
const settingsPath = join(target, '.claude', 'settings.json');
const settingsExists = existsSync(settingsPath);
check('.claude/settings.json exists', settingsExists, 'Run: npx orchestre init');

if (settingsExists) {
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    const preToolUse = settings?.hooks?.PreToolUse || [];
    const hasPreWrite = preToolUse.some(h => h.command?.includes('orchestre-guard') && h.command?.includes('pre-write'));
    check('Pre-write hook configured', hasPreWrite, 'settings.json missing orchestre-guard pre-write hook');

    if (hasPreWrite) {
      const cmd = preToolUse.find(h => h.command?.includes('pre-write'))?.command || '';
      const guardPath = cmd.replace('node ', '').replace(' --mode pre-write', '').trim();
      check('Hook path resolves', existsSync(join(target, guardPath)), `File not found: ${guardPath}. Check the path in settings.json`);
    }
  } catch {
    check('settings.json is valid JSON', false, 'Parse error in .claude/settings.json');
  }
}

// --- Stack ---
console.log('\nStack:');
const manifestPath = join(target, '.orchestre', 'install-manifest.json');
if (existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    console.log(`  Stack: ${manifest.stack || 'unknown'}`);
    console.log(`  Installed: ${manifest.installed_at || 'unknown'}`);
    console.log(`  Files: ${manifest.files?.length || 0}`);
  } catch {}
} else {
  warn('Install manifest exists', false, 'No .orchestre/install-manifest.json — fresh install or manual setup');
}

// --- Agents ---
console.log('\nAgents:');
const agentsDir = join(target, '.claude', 'agents');
check('.claude/agents/ exists', existsSync(agentsDir));
const requiredAgents = ['wave-0-linter.md', 'wave-1-decomposer.md', 'wave-2-planner.md', 'wave-3-generator.md', 'wave-4-auditor.md'];
for (const agent of requiredAgents) {
  check(`  ${agent}`, existsSync(join(agentsDir, agent)));
}

// --- Skills ---
console.log('\nSkills:');
const requiredSkills = ['orchestre-go', 'orchestre-audit', 'orchestre-extend', 'orchestre-harden', 'orchestre-deploy-check', 'orchestre-recover'];
for (const skill of requiredSkills) {
  check(`  ${skill}`, existsSync(join(target, '.claude', 'skills', skill, 'SKILL.md')));
}

// --- Knowledge ---
console.log('\nKnowledge:');
warn('core/knowledge/ exists', existsSync(join(target, 'core', 'knowledge')));

// --- Summary ---
console.log('\n' + '─'.repeat(40));
console.log(`\n  Passed:   ${passed}`);
if (warnings > 0) console.log(`  Warnings: ${warnings}`);
if (failed > 0) console.log(`  \x1b[31mFailed:   ${failed}\x1b[0m`);
console.log('');

if (failed === 0) {
  console.log('  \x1b[32m✓ Orchestre is correctly installed.\x1b[0m\n');
} else {
  console.log('  \x1b[31m✗ Installation has issues. Run: npx orchestre init\x1b[0m\n');
  process.exit(1);
}
