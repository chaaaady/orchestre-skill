#!/usr/bin/env node
/**
 * Orchestre CLI — entry point for `npx orchestre <command>`
 *
 * Commands:
 *   init [--stack <name>]   Install Orchestre in current project
 *   list-stacks             Show available stacks
 *   uninstall               Remove Orchestre from current project
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const installScript = resolve(__dirname, 'install.mjs');

const args = process.argv.slice(2);
const command = args[0];

function usage() {
  console.log(`
  orchestre — Clean architecture for AI code generation

  Usage:
    npx orchestre init                           Install with default stack (nextjs-supabase)
    npx orchestre init --stack sveltekit-drizzle  Install with specific stack
    npx orchestre list-stacks                    Show available stacks
    npx orchestre uninstall                      Remove from current project

  Options:
    --stack <name>    Stack to install (default: nextjs-supabase)
    --global          Install to ~/.claude/ (global quality layer)

  Stacks:
    nextjs-supabase     Next.js + Supabase + Tailwind + Stripe
    sveltekit-drizzle   SvelteKit + Drizzle + Tailwind + Stripe
`);
}

switch (command) {
  case 'init': {
    const passthrough = ['.', ...args.slice(1)];
    execFileSync('node', [installScript, ...passthrough], { stdio: 'inherit' });
    break;
  }

  case 'list-stacks':
    execFileSync('node', [installScript, '--list-stacks'], { stdio: 'inherit' });
    break;

  case 'uninstall':
    execFileSync('node', [installScript, '.', '--uninstall'], { stdio: 'inherit' });
    break;

  case 'help':
  case '--help':
  case '-h':
  case undefined:
    usage();
    break;

  default:
    console.error(`Unknown command: ${command}`);
    usage();
    process.exit(1);
}
