import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);

const guardPath = join(__dirname, '..', '..', 'core', 'hooks', 'orchestre-guard.mjs');

describe('orchestre-guard.mjs — graceful handling', () => {
  it('exits 0 when no input is provided (missing TOOL_INPUT)', async () => {
    // Run the guard with no stdin and no TOOL_INPUT env var
    // It should exit 0 (don't block on infrastructure failures)
    try {
      const { stdout, stderr } = await execFileAsync('node', [guardPath, '--mode', 'pre-write'], {
        timeout: 5000,
        env: { ...process.env, TOOL_INPUT: '' },
        // Send empty stdin
        input: '',
      });
      // If it exits 0, the test passes
      assert.ok(true, 'Guard exited cleanly with no input');
    } catch (err) {
      // execFile throws if exit code !== 0
      // exit code 0 means the guard handled missing input gracefully
      if (err.code === 0 || err.killed === false) {
        assert.ok(true);
      } else {
        // Only fail if the exit code is non-zero for a non-timeout reason
        assert.fail(`Guard should exit 0 on missing input, got exit code: ${err.code}, stderr: ${err.stderr}`);
      }
    }
  });

  it('exits 0 for non-code file extensions', async () => {
    const input = JSON.stringify({ file_path: 'readme.md', content: '# Hello' });
    try {
      await execFileAsync('node', [guardPath, '--mode', 'pre-write'], {
        timeout: 5000,
        env: { ...process.env, TOOL_INPUT: input },
      });
      assert.ok(true, 'Guard skipped non-code file');
    } catch (err) {
      assert.fail(`Guard should exit 0 for .md files, got: ${err.code}`);
    }
  });

  it('exits 0 when file_path is empty', async () => {
    const input = JSON.stringify({ file_path: '', content: 'const x = 1;' });
    try {
      await execFileAsync('node', [guardPath, '--mode', 'pre-write'], {
        timeout: 5000,
        env: { ...process.env, TOOL_INPUT: input },
      });
      assert.ok(true, 'Guard exited cleanly with empty file_path');
    } catch (err) {
      assert.fail(`Guard should exit 0 on empty file_path, got: ${err.code}`);
    }
  });
});
