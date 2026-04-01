import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = join(__dirname, '..', '..', 'fixed-assets', 'library-templates');

describe('library template validity', () => {
  const mdFiles = readdirSync(templatesDir).filter(f => f.endsWith('.md') && f !== 'README.md');

  it('has at least 15 template files', () => {
    assert.ok(mdFiles.length >= 15, `Found only ${mdFiles.length} templates`);
  });

  for (const file of mdFiles) {
    describe(file, () => {
      const content = readFileSync(join(templatesDir, file), 'utf8');

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
