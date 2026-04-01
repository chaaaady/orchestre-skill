#!/usr/bin/env node
/**
 * Orchestre V2 — Smart Installer
 *
 * Usage:
 *   node bin/install.mjs [target-dir] [--stack <name>] [--uninstall] [--global]
 *
 * Examples:
 *   node bin/install.mjs .                          # Install to current project (default stack)
 *   node bin/install.mjs . --stack nextjs-supabase   # Explicit stack
 *   node bin/install.mjs --global                    # Install to ~/.claude/ (global)
 *   node bin/install.mjs . --uninstall               # Uninstall from project
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
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
      // For arrays (like hooks), filter out old orchestre entries and add new ones
      const filtered = result[key].filter(item => {
        if (typeof item === 'object' && item.command) {
          return !item.command.includes('orchestre');
        }
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

  // Skip if identical
  if (existing && sha256(existing) === srcHash) {
    return 'skipped';
  }

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
  const orchestreSettingsPath = join(PKG_ROOT, '.claude', 'settings.json');

  const existing = safeRead(settingsPath);
  const orchestre = JSON.parse(readFileSync(orchestreSettingsPath, 'utf8'));

  // Update hook commands to use new Node.js guard
  const v2Hooks = {
    hooks: {
      PreToolUse: [
        { matcher: "Write|Edit", command: "node hooks/orchestre-guard.mjs --mode pre-write" }
      ],
      PostToolUse: [
        { matcher: "Write|Edit", command: "node hooks/orchestre-guard.mjs --mode post-write" }
      ]
    }
  };

  if (existing) {
    manifest.files.push({
      path: settingsPath,
      original_hash: sha256(existing),
      orchestre_hash: null, // Will be set after merge
      action: 'merged',
    });
    const merged = deepMerge(JSON.parse(existing), v2Hooks);
    const content = JSON.stringify(merged, null, 2);
    manifest.files[manifest.files.length - 1].orchestre_hash = sha256(content);
    writeFileSync(settingsPath, content);
  } else {
    ensureDir(dirname(settingsPath));
    const content = JSON.stringify(v2Hooks, null, 2);
    manifest.files.push({
      path: settingsPath,
      original_hash: null,
      orchestre_hash: sha256(content),
      action: 'created',
    });
    writeFileSync(settingsPath, content);
  }
}

// --- CLAUDE.md generation ---

function generateClaudeMd(target, stackName, manifest) {
  const claudePath = join(target, 'CLAUDE.md');
  const templatePath = join(PKG_ROOT, 'CLAUDE.md.template');
  const existing = safeRead(claudePath);

  // Load stack manifests
  const basePath = join(PKG_ROOT, 'stacks', '_base.stack.json');
  const stackPath = join(PKG_ROOT, 'stacks', `${stackName}.stack.json`);

  let base = {}, stack = {};
  try { base = JSON.parse(readFileSync(basePath, 'utf8')); } catch {}
  try { stack = JSON.parse(readFileSync(stackPath, 'utf8')); } catch {}

  // Merge rules
  const allRules = { ...(base.rules || {}), ...(stack.rules || {}) };
  const rulesSection = Object.values(allRules)
    .filter(r => r.enabled)
    .map(r => `### ${r.id} — ${r.description}`)
    .join('\n\n');

  // Singletons
  const singletons = stack.singletons || {};
  let singletonsSection = '';
  if (Object.keys(singletons).length > 0) {
    singletonsSection = '### Singletons\n| Client | File |\n|--------|------|\n' +
      Object.entries(singletons).map(([name, cfg]) => `| ${name} | \`${cfg.file}\` |`).join('\n');
  }

  // Design system
  const ds = stack.design_system || {};
  let designSection = '';
  if (ds.semantic_tokens_only) {
    designSection = `### Design System\n- **NEVER** hardcoded Tailwind colors: ~~bg-blue-500~~ ~~text-red-600~~\n- **ALWAYS** semantic tokens: \`bg-primary\`, \`text-destructive\`, \`border-border\`\n- Icons: ${ds.icons || 'SVG'} only. ${ds.no_emoji_icons ? 'No emoji as icons.' : ''}`;
  }

  // Folder structure
  const fs = stack.folder_structure || {};
  const folderStructure = Object.entries(fs).map(([k, v]) => `${k.padEnd(14)} <- ${v}`).join('\n');

  // Security
  const sec = { ...(base.security || {}), ...(stack.security || {}) };
  const securityLines = [];
  if (sec.rls_on_all_user_tables) securityLines.push('- **RLS enabled** on all user tables');
  if (sec.get_user_not_get_session) securityLines.push('- **`getUser()`** not `getSession()` for sensitive ops');
  if (sec.zod_validation_server_side) securityLines.push('- **Zod validation** server-side on all inputs');
  if (sec.webhook_signature_verification) securityLines.push('- **Webhook signatures** verified');
  if (sec.env_validation_required) securityLines.push('- **`lib/config.ts`** validates ENV vars at boot');
  if (sec.no_next_public_secrets) securityLines.push('- **Never `NEXT_PUBLIC_`** on secrets');
  if (sec.no_console_log_sensitive) securityLines.push('- **Never `console.log`** with sensitive data');

  // Knowledge
  const kb = [...(base.knowledge_base || []), ...(stack.knowledge_base || [])];
  const knowledgeTable = kb.length > 0
    ? '| Topic | File |\n|-------|------|\n' + kb.map(k => `| ${k} | \`fixed-assets/library-templates/${k}.md\` |`).join('\n')
    : '';

  // If template exists, use it; otherwise generate directly
  let content;
  if (existsSync(templatePath)) {
    content = readFileSync(templatePath, 'utf8')
      .replace('{{STACK_NAME}}', stack.name || base.name || stackName)
      .replace('{{RULES_SECTION}}', rulesSection)
      .replace('{{IMPORT_ALIAS}}', (base.coding_standards || {}).import_alias || '@/')
      .replace('{{SINGLETONS_SECTION}}', singletonsSection)
      .replace('{{DESIGN_SYSTEM_SECTION}}', designSection)
      .replace('{{FOLDER_STRUCTURE}}', folderStructure)
      .replace('{{SECURITY_SECTION}}', securityLines.join('\n'))
      .replace('{{KNOWLEDGE_TABLE}}', knowledgeTable);
  } else {
    // Fallback: use the existing CLAUDE.md from package
    const fallback = safeRead(join(PKG_ROOT, 'CLAUDE.md'));
    content = fallback || `# Orchestre — ${stackName}\n\nStack: ${stackName}`;
  }

  if (existing) {
    manifest.files.push({
      path: claudePath,
      original_hash: sha256(existing),
      orchestre_hash: sha256(content),
      action: 'modified',
    });
  } else {
    manifest.files.push({
      path: claudePath,
      original_hash: null,
      orchestre_hash: sha256(content),
      action: 'created',
    });
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

  let restored = 0;
  let removed = 0;

  for (const entry of manifest.files) {
    if (entry.action === 'created') {
      // File was created by Orchestre — remove it
      try { rmSync(entry.path); removed++; } catch {}
    } else if (entry.action === 'modified' || entry.action === 'merged') {
      // File existed before — we can't restore it without a backup
      // Just inform the user
      console.log(`   Cannot restore ${entry.path} (original hash: ${entry.original_hash})`);
    }
  }

  // Remove manifest
  try { rmSync(join(target, '.orchestre', 'install-manifest.json')); } catch {}

  console.log(`\nUninstalled. ${removed} files removed.`);
}

// --- Main ---

function main() {
  const args = process.argv.slice(2);

  const isGlobal = args.includes('--global');
  const isUninstall = args.includes('--uninstall');
  const stackIdx = args.indexOf('--stack');
  const stackName = stackIdx !== -1 ? args[stackIdx + 1] : 'nextjs-supabase';

  // Determine target
  let target;
  if (isGlobal) {
    target = join(homedir(), '.claude');
  } else {
    const positional = args.filter(a => !a.startsWith('--') && (stackIdx === -1 || a !== args[stackIdx + 1]));
    target = resolve(positional[0] || '.');
  }

  if (isUninstall) {
    uninstall(target);
    return;
  }

  console.log('Orchestre V2 — Smart Installer');
  console.log(`   Target: ${target}`);
  console.log(`   Stack:  ${stackName}`);
  console.log('');

  const manifest = {
    version: '2.0.0',
    stack: stackName,
    installed_at: new Date().toISOString(),
    files: [],
  };

  // 1. Generate CLAUDE.md from stack manifest + template
  if (!isGlobal) {
    generateClaudeMd(target, stackName, manifest);
    console.log('   CLAUDE.md (generated from stack manifest)');
  }

  // 2. Copy .claude/ (agents, rules, skills)
  ensureDir(join(target, '.claude'));
  const agentCount = copyDirTracked(join(PKG_ROOT, '.claude', 'agents'), join(target, '.claude', 'agents'), manifest);
  const rulesCount = copyDirTracked(join(PKG_ROOT, '.claude', 'rules'), join(target, '.claude', 'rules'), manifest);
  const skillsCount = copyDirTracked(join(PKG_ROOT, '.claude', 'skills'), join(target, '.claude', 'skills'), manifest);
  console.log(`   .claude/ (${agentCount} agents, ${rulesCount} rules, ${skillsCount} skills)`);

  // 3. Merge settings.json
  if (!isGlobal) {
    mergeSettings(target, manifest);
    console.log('   .claude/settings.json (merged, not overwritten)');
  }

  // 4. Copy hooks (new Node.js system)
  const hooksCount = copyDirTracked(join(PKG_ROOT, 'hooks'), join(target, 'hooks'), manifest);
  console.log(`   hooks/ (${hooksCount} files — AST-based V2 guards)`);

  // 5. Copy fixed-assets
  const templatesCount = copyDirTracked(join(PKG_ROOT, 'fixed-assets'), join(target, 'fixed-assets'), manifest);
  console.log(`   fixed-assets/ (${templatesCount} library templates)`);

  // 6. Copy knowledge-base
  const kbCount = copyDirTracked(join(PKG_ROOT, 'knowledge-base'), join(target, 'knowledge-base'), manifest);
  console.log(`   knowledge-base/ (${kbCount} files)`);

  // 7. Copy contracts, profiles, infrastructure, stacks
  copyDirTracked(join(PKG_ROOT, 'contracts'), join(target, 'contracts'), manifest);
  copyDirTracked(join(PKG_ROOT, 'profiles'), join(target, 'profiles'), manifest);
  copyDirTracked(join(PKG_ROOT, 'infrastructure'), join(target, 'infrastructure'), manifest);
  copyDirTracked(join(PKG_ROOT, 'stacks'), join(target, 'stacks'), manifest);
  console.log('   contracts/ + profiles/ + infrastructure/ + stacks/');

  // 8. Update .gitignore
  if (!isGlobal) {
    const gitignorePath = join(target, '.gitignore');
    const gitignore = safeRead(gitignorePath) || '';
    if (!gitignore.includes('.orchestre/')) {
      const addition = '\n# Orchestre\n.orchestre/\n';
      writeFileSync(gitignorePath, gitignore + addition);
    }
  }

  // 9. Save manifest
  saveManifest(target, manifest);

  console.log('');
  console.log(`Orchestre V2 installed! (${manifest.files.length} files, stack: ${stackName})`);
  console.log('');
  console.log('   Active NOW:');
  console.log('   - CLAUDE.md — architecture rules, coding standards, security');
  console.log('   - hooks/ — AST-based pre-write guards (zero false positives)');
  console.log('   - contracts/ — JSON Schema validation for wave outputs');
  console.log('');
  console.log('   Available:');
  console.log('   - /orchestre-go "description" — generate a full project');
  console.log('   - /orchestre-audit — audit code quality (/100)');
  console.log('   - /orchestre-status — show pipeline progress');
  console.log('');
  console.log('   Rollback: node bin/install.mjs --uninstall');
}

main();
