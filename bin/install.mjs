#!/usr/bin/env node
/**
 * Orchestre V3 — Smart Installer (core/stacks architecture)
 *
 * Usage:
 *   node bin/install.mjs [target-dir] [--stack <name>] [--uninstall] [--global]
 *
 * Examples:
 *   node bin/install.mjs .                          # Install to current project (default stack)
 *   node bin/install.mjs . --stack nextjs-supabase   # Explicit stack
 *   node bin/install.mjs . --stack sveltekit-drizzle # Different stack
 *   node bin/install.mjs --global                    # Install to ~/.claude/ (global)
 *   node bin/install.mjs . --uninstall               # Uninstall from project
 *
 * New architecture:
 *   - core/     = universal (contracts, infrastructure, profiles, base hooks, agents)
 *   - stacks/   = stack-specific (hooks, knowledge, templates, rules, CLAUDE.stack.md)
 *   - Installer assembles: core + stacks/{id} -> target project
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, '..');

// --- Helpers ---

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function safeRead(path) {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const [key, val] of Object.entries(source)) {
    if (val && typeof val === 'object' && !Array.isArray(val) && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key], val);
    } else if (Array.isArray(val) && Array.isArray(result[key])) {
      const filtered = result[key].filter(item => {
        if (typeof item === 'object' && item.command) return !item.command.includes('orchestre');
        return true;
      });
      result[key] = [...filtered, ...val];
    } else {
      result[key] = val;
    }
  }
  return result;
}

// --- Manifest ---

function loadManifest(target) {
  const path = join(target, '.orchestre', 'install-manifest.json');
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function saveManifest(target, manifest) {
  const dir = join(target, '.orchestre');
  ensureDir(dir);
  writeFileSync(join(dir, 'install-manifest.json'), JSON.stringify(manifest, null, 2));
}

// --- Copy with tracking ---

function copyTracked(src, dest, manifest) {
  const existing = safeRead(dest);
  const srcContent = readFileSync(src);
  const srcHash = sha256(srcContent);

  if (existing && sha256(existing) === srcHash) return 'skipped';

  manifest.files.push({
    path: dest,
    original_hash: existing ? sha256(existing) : null,
    orchestre_hash: srcHash,
    action: existing ? 'modified' : 'created',
  });

  ensureDir(dirname(dest));
  writeFileSync(dest, srcContent);
  return existing ? 'updated' : 'created';
}

function copyDirTracked(srcDir, destDir, manifest) {
  if (!existsSync(srcDir)) return 0;
  ensureDir(destDir);
  let count = 0;
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += copyDirTracked(join(srcDir, entry.name), join(destDir, entry.name), manifest);
    } else {
      copyTracked(join(srcDir, entry.name), join(destDir, entry.name), manifest);
      count++;
    }
  }
  return count;
}

// --- Settings merge ---

function mergeSettings(target, manifest) {
  const settingsPath = join(target, '.claude', 'settings.json');

  const v2Hooks = {
    hooks: {
      PreToolUse: [
        { matcher: "Write|Edit", command: "node core/hooks/orchestre-guard.mjs --mode pre-write" }
      ],
      PostToolUse: [
        { matcher: "Write|Edit", command: "node core/hooks/orchestre-guard.mjs --mode post-write" }
      ]
    }
  };

  const existing = safeRead(settingsPath);
  if (existing) {
    manifest.files.push({ path: settingsPath, original_hash: sha256(existing), orchestre_hash: null, action: 'merged' });
    const merged = deepMerge(JSON.parse(existing), v2Hooks);
    const content = JSON.stringify(merged, null, 2);
    manifest.files[manifest.files.length - 1].orchestre_hash = sha256(content);
    writeFileSync(settingsPath, content);
  } else {
    ensureDir(dirname(settingsPath));
    const content = JSON.stringify(v2Hooks, null, 2);
    manifest.files.push({ path: settingsPath, original_hash: null, orchestre_hash: sha256(content), action: 'created' });
    writeFileSync(settingsPath, content);
  }
}

// --- CLAUDE.md assembly (core/CLAUDE.base.md + stacks/{id}/CLAUDE.stack.md) ---

function assembleClaudeMd(target, stackName, manifest) {
  const claudePath = join(target, 'CLAUDE.md');
  const existing = safeRead(claudePath);

  // Read base
  const baseMdPath = join(PKG_ROOT, 'core', 'CLAUDE.base.md');
  let baseMd = safeRead(baseMdPath) || '# Orchestre — Quality Layer\n';

  // Read stack-specific
  const stackMdPath = join(PKG_ROOT, 'stacks', stackName, 'CLAUDE.stack.md');
  const stackMd = safeRead(stackMdPath) || '';

  // Load stack.json for metadata
  const stackJsonPath = join(PKG_ROOT, 'stacks', stackName, 'stack.json');
  let stackJson = {};
  try { stackJson = JSON.parse(readFileSync(stackJsonPath, 'utf8')); } catch {}

  // Replace {{STACK_NAME}} in base
  baseMd = baseMd.replace(/\{\{STACK_NAME\}\}/g, stackJson.name || stackName);

  // Assemble: base + separator + stack
  const separator = '\n\n---\n\n# Stack-Specific Configuration\n\n';
  const content = baseMd + (stackMd ? separator + stackMd : '');

  if (existing) {
    manifest.files.push({ path: claudePath, original_hash: sha256(existing), orchestre_hash: sha256(content), action: 'modified' });
  } else {
    manifest.files.push({ path: claudePath, original_hash: null, orchestre_hash: sha256(content), action: 'created' });
  }

  writeFileSync(claudePath, content);
}

// --- Uninstall ---

function uninstall(target) {
  const manifest = loadManifest(target);
  if (!manifest) {
    console.error('No install manifest found. Cannot uninstall.');
    process.exit(1);
  }

  let removed = 0;
  for (const entry of manifest.files) {
    if (entry.action === 'created') {
      try { rmSync(entry.path); removed++; } catch {}
    } else if (entry.action === 'modified' || entry.action === 'merged') {
      console.log(`   Cannot restore ${entry.path} (original hash: ${entry.original_hash})`);
    }
  }

  try { rmSync(join(target, '.orchestre', 'install-manifest.json')); } catch {}
  console.log(`\nUninstalled. ${removed} files removed.`);
}

// --- Main ---

function main() {
  const args = process.argv.slice(2);

  // List available stacks
  if (args.includes('--list-stacks')) {
    const stacksDir = join(PKG_ROOT, 'stacks');
    const stacks = readdirSync(stacksDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => {
        const sj = safeRead(join(stacksDir, e.name, 'stack.json'));
        const name = sj ? JSON.parse(sj).name : e.name;
        return `   ${e.name.padEnd(25)} ${name}`;
      });
    console.log('Available stacks:');
    stacks.forEach(s => console.log(s));
    return;
  }

  const isGlobal = args.includes('--global');
  const isUninstall = args.includes('--uninstall');
  const stackIdx = args.indexOf('--stack');
  const stackName = stackIdx !== -1 ? args[stackIdx + 1] : 'nextjs-supabase';

  // Validate stack exists
  const stackDir = join(PKG_ROOT, 'stacks', stackName);
  if (!existsSync(stackDir) || !existsSync(join(stackDir, 'stack.json'))) {
    console.error(`Stack "${stackName}" not found. Run with --list-stacks to see available stacks.`);
    process.exit(1);
  }

  let target;
  if (isGlobal) {
    target = join(homedir(), '.claude');
  } else {
    const positional = args.filter(a => !a.startsWith('--') && (stackIdx === -1 || a !== args[stackIdx + 1]));
    target = resolve(positional[0] || '.');
  }

  if (isUninstall) { uninstall(target); return; }

  console.log('Orchestre V3 — Smart Installer');
  console.log(`   Target: ${target}`);
  console.log(`   Stack:  ${stackName}`);
  console.log('');

  const manifest = {
    version: '3.0.0',
    stack: stackName,
    installed_at: new Date().toISOString(),
    files: [],
  };

  // 1. Assemble CLAUDE.md from core/CLAUDE.base.md + stacks/{id}/CLAUDE.stack.md
  if (!isGlobal) {
    assembleClaudeMd(target, stackName, manifest);
    console.log('   CLAUDE.md (assembled from core + stack)');
  }

  // 2. Copy core/ (contracts, infrastructure, profiles, base hooks, knowledge, runtime)
  copyDirTracked(join(PKG_ROOT, 'core', 'contracts'), join(target, 'core', 'contracts'), manifest);
  copyDirTracked(join(PKG_ROOT, 'core', 'infrastructure'), join(target, 'core', 'infrastructure'), manifest);
  copyDirTracked(join(PKG_ROOT, 'core', 'profiles'), join(target, 'core', 'profiles'), manifest);
  copyDirTracked(join(PKG_ROOT, 'core', 'hooks'), join(target, 'core', 'hooks'), manifest);
  copyDirTracked(join(PKG_ROOT, 'core', 'knowledge'), join(target, 'core', 'knowledge'), manifest);
  copyDirTracked(join(PKG_ROOT, 'core', 'runtime'), join(target, 'core', 'runtime'), manifest);
  console.log('   core/ (contracts, infrastructure, profiles, hooks, knowledge, runtime)');

  // 3. Copy core agents -> .claude/agents/
  ensureDir(join(target, '.claude'));
  const agentCount = copyDirTracked(join(PKG_ROOT, 'core', 'agents'), join(target, '.claude', 'agents'), manifest);
  console.log(`   .claude/agents/ (${agentCount} agents from core)`);

  // 4. Copy stack-specific files
  const stackSrc = join(PKG_ROOT, 'stacks', stackName);

  // Stack hooks -> stacks/{id}/hooks/
  const stackHooksCount = copyDirTracked(join(stackSrc, 'hooks'), join(target, 'stacks', stackName, 'hooks'), manifest);
  console.log(`   stacks/${stackName}/hooks/ (${stackHooksCount} stack checkers)`);

  // Stack knowledge -> stacks/{id}/knowledge/
  const stackKnowledgeCount = copyDirTracked(join(stackSrc, 'knowledge'), join(target, 'stacks', stackName, 'knowledge'), manifest);
  console.log(`   stacks/${stackName}/knowledge/ (${stackKnowledgeCount} library templates)`);

  // Stack templates -> stacks/{id}/templates/
  const stackTemplatesCount = copyDirTracked(join(stackSrc, 'templates'), join(target, 'stacks', stackName, 'templates'), manifest);
  console.log(`   stacks/${stackName}/templates/ (${stackTemplatesCount} code templates)`);

  // Stack env-templates -> stacks/{id}/env-templates/
  copyDirTracked(join(stackSrc, 'env-templates'), join(target, 'stacks', stackName, 'env-templates'), manifest);

  // Stack rules -> .claude/rules/
  const rulesCount = copyDirTracked(join(stackSrc, 'rules'), join(target, '.claude', 'rules'), manifest);
  console.log(`   .claude/rules/ (${rulesCount} stack rules)`);

  // Stack config
  copyTracked(join(stackSrc, 'stack.json'), join(target, 'stacks', stackName, 'stack.json'), manifest);

  // 5. Copy skills
  const skillsCount = copyDirTracked(join(PKG_ROOT, '.claude', 'skills'), join(target, '.claude', 'skills'), manifest);
  console.log(`   .claude/skills/ (${skillsCount} skills)`);

  // 6. Merge settings.json (hook commands point to core/hooks/)
  if (!isGlobal) {
    mergeSettings(target, manifest);
    console.log('   .claude/settings.json (merged)');
  }

  // 7. Update .gitignore
  if (!isGlobal) {
    const gitignorePath = join(target, '.gitignore');
    const gitignore = safeRead(gitignorePath) || '';
    if (!gitignore.includes('.orchestre/')) {
      writeFileSync(gitignorePath, gitignore + '\n# Orchestre\n.orchestre/\n');
    }
  }

  // 8. Save manifest
  saveManifest(target, manifest);

  console.log('');
  console.log(`Orchestre V3 installed! (${manifest.files.length} files, stack: ${stackName})`);
  console.log('');
  console.log('   Active NOW:');
  console.log('   - CLAUDE.md — universal rules + stack-specific config');
  console.log('   - core/hooks/ — universal guards (secrets)');
  console.log(`   - stacks/${stackName}/hooks/ — stack-specific guards`);
  console.log('');
  console.log('   Available:');
  console.log('   - /orchestre-go "description" — generate a full project');
  console.log('   - /orchestre-audit — audit code quality (/100)');
  console.log('   - /orchestre-status — show pipeline progress');
  console.log('');
  console.log('   Rollback: node bin/install.mjs --uninstall');
}

main();
