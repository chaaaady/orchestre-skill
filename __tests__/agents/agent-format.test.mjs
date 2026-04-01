import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentsDir = join(__dirname, '..', '..', '.claude', 'agents');

const REQUIRED_SECTIONS = [
  /##\s*(IDENTITY|Identity|Role)/i,
  /##\s*(MISSION|Mission|Goal)/i,
  /##\s*(PROCESS|Process|Steps|Workflow)/i,
];

const RECOMMENDED_SECTIONS = [
  /##\s*(OUTPUT|Output|Outputs|Deliverables|SCORE|Score|Report)/i,
  /##\s*(TURN.?LOOP|Turn.?Loop|Constraints|Limits)/i,
  /##\s*(RULES|Rules|Guardrails)/i,
];

describe('agent format validation', () => {
  const agentFiles = readdirSync(agentsDir).filter(f => f.endsWith('.md'));

  it('has at least 6 agent files', () => {
    assert.ok(agentFiles.length >= 6, `Found only ${agentFiles.length} agents`);
  });

  for (const file of agentFiles) {
    describe(file, () => {
      const content = readFileSync(join(agentsDir, file), 'utf8');

      it('has a title (H1 heading)', () => {
        assert.ok(/^#\s+\S/m.test(content), `${file} missing H1 heading`);
      });

      for (const pattern of REQUIRED_SECTIONS) {
        it(`has required section matching ${pattern.source}`, () => {
          assert.ok(pattern.test(content), `${file} missing section matching ${pattern.source}`);
        });
      }

      it('has at least 1 recommended section', () => {
        const hasRecommended = RECOMMENDED_SECTIONS.some(p => p.test(content));
        assert.ok(hasRecommended, `${file} missing recommended sections (TURN-LOOP, RULES)`);
      });

      it('is not empty', () => {
        assert.ok(content.trim().length > 100, `${file} is too short (${content.length} chars)`);
      });
    });
  }
});
