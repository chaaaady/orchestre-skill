/**
 * Permission Context — per-wave tool allow/deny.
 *
 * Makes core/infrastructure/permission-context.md executable.
 * Defaults mirror that spec; override via .orchestre/permissions.json.
 *
 * Decision model:
 *   - allow = ["*"] → everything except deny_names/deny_prefixes
 *   - allow = [...list] → only listed tools (deny lists still apply)
 *   - case-insensitive match on tool names; prefixes match with startsWith
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_CONTEXTS = Object.freeze({
  '0': {
    wave: 0, mode: 'plan',
    allow: ['Read', 'Glob', 'Grep', 'AskUserQuestion'],
    deny_names: ['Write', 'Edit', 'Bash', 'Agent'],
    deny_prefixes: ['mcp_'],
    deny_reason: 'Wave 0 is read-only: validation only, no file modifications',
  },
  '1': {
    wave: 1, mode: 'plan',
    allow: ['Read', 'Glob', 'Grep', 'AskUserQuestion', 'Write', 'TaskCreate', 'TaskUpdate', 'TaskList'],
    deny_names: ['Edit', 'Bash', 'Agent'],
    deny_prefixes: [],
    deny_reason: 'Wave 1 can write to .orchestre/ only, no code editing',
    write_restrict: '.orchestre/',
  },
  '2': {
    wave: 2, mode: 'plan',
    allow: ['Read', 'Glob', 'Grep', 'Write', 'TaskCreate', 'TaskUpdate', 'TaskList', 'AskUserQuestion'],
    deny_names: ['Edit', 'Bash', 'Agent'],
    deny_prefixes: [],
    deny_reason: 'Wave 2 plans but does not code',
    write_restrict: '.orchestre/',
  },
  '3': {
    wave: 3, mode: 'execute',
    allow: ['*'],
    deny_names: [],
    deny_prefixes: [],
    deny_reason: null,
  },
  '4': {
    wave: 4, mode: 'readonly',
    allow: ['Read', 'Glob', 'Grep', 'Bash', 'Write', 'AskUserQuestion'],
    deny_names: ['Edit', 'Agent'],
    deny_prefixes: [],
    deny_reason: 'Wave 4 audits but does not modify project code',
    write_restrict: '.orchestre/',
  },
});

export function loadContexts(projectRoot) {
  const p = join(projectRoot, '.orchestre', 'permissions.json');
  if (!existsSync(p)) return { ...DEFAULT_CONTEXTS };
  try {
    const custom = JSON.parse(readFileSync(p, 'utf8'));
    const merged = { ...DEFAULT_CONTEXTS };
    for (const key of Object.keys(custom || {})) {
      merged[key] = { ...(DEFAULT_CONTEXTS[key] || {}), ...custom[key] };
    }
    return merged;
  } catch {
    return { ...DEFAULT_CONTEXTS };
  }
}

export function contextFor(wave, contexts) {
  const map = contexts || DEFAULT_CONTEXTS;
  return map[String(wave)] || null;
}

export function decide({ context, toolName, filePath }) {
  if (!context) return { allowed: true, reason: 'no context for wave' };
  if (!toolName) return { allowed: true, reason: 'tool_name missing, passthrough' };

  const name = String(toolName);
  const nameLower = name.toLowerCase();

  // deny_prefixes (case-insensitive)
  for (const prefix of context.deny_prefixes || []) {
    if (nameLower.startsWith(String(prefix).toLowerCase())) {
      return { allowed: false, rule: 'deny_prefix', prefix, reason: context.deny_reason };
    }
  }

  // deny_names (case-insensitive)
  for (const denied of context.deny_names || []) {
    if (nameLower === String(denied).toLowerCase()) {
      return { allowed: false, rule: 'deny_name', toolName: denied, reason: context.deny_reason };
    }
  }

  // allow list
  const allow = context.allow || [];
  const wildcard = allow.includes('*');
  if (!wildcard) {
    const isAllowed = allow.some(t => String(t).toLowerCase() === nameLower);
    if (!isAllowed) {
      return { allowed: false, rule: 'not_in_allow', reason: context.deny_reason || `Wave ${context.wave}: ${name} not in allow list` };
    }
  }

  // write_restrict: Write/Edit allowed but only under specific path
  if (context.write_restrict && /^(write|edit)$/i.test(name) && filePath) {
    const rel = String(filePath).replace(/^\.\//, '');
    if (!rel.startsWith(context.write_restrict)) {
      return {
        allowed: false, rule: 'write_restrict',
        restrict: context.write_restrict,
        reason: `Wave ${context.wave}: writes restricted to ${context.write_restrict}`,
      };
    }
  }

  return { allowed: true };
}
