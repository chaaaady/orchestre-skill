import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

// Collect all .md knowledge files from core + stacks
const knowledgeDirs = [
  join(root, 'core', 'knowledge'),
  join(root, 'stacks', 'nextjs-supabase', 'knowledge'),
];

const allTemplates = [];
for (const dir of knowledgeDirs) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (f.endsWith('.md') && f !== 'README.md') {
      allTemplates.push({ file: f, path: join(dir, f) });
    }
  }
}

describe('library template validity', () => {
  it('has at least 15 template files across core + stacks', () => {
    assert.ok(allTemplates.length >= 15, `Found only ${allTemplates.length} templates`);
  });

  for (const { file, path: filePath } of allTemplates) {
    describe(file, () => {
      const content = readFileSync(filePath, 'utf8');

      it('is valid markdown (has H1 or H2 heading)', () => {
        assert.ok(/^#{1,2}\s+\S/m.test(content), `${file} missing heading`);
      });

      it('has meaningful content (> 200 chars)', () => {
        assert.ok(content.length > 200, `${file} too short: ${content.length} chars`);
      });

      it('has no unclosed code blocks', () => {
        const codeBlockCount = (content.match(/```/g) || []).length;
        assert.equal(codeBlockCount % 2, 0, `${file} has ${codeBlockCount} backtick fences (odd = unclosed)`);
      });
    });
  }
});
