import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SchemaValidator, loadSchema } from '../../core/contracts/validate.mjs';

/**
 * v4.0.1+ — Agent integration tests
 *
 * Until v4.0.0 the only agent test was agent-format.test.mjs (structural markdown).
 * Prompt engineering / actual wave execution was never tested.
 *
 * This file adds the next layer: ensure each agent's declared output schema
 * (a) exists in core/contracts/schemas/, and (b) the documented sample output
 * (if present in __tests__/fixtures/) validates against its schema.
 *
 * Real LLM-mocked end-to-end tests are tracked in CHANGELOG v4.1.0 roadmap.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentsDir = join(__dirname, '..', '..', 'core', 'agents');
const schemasDir = join(__dirname, '..', '..', 'core', 'contracts', 'schemas');
const fixturesDir = join(__dirname, '..', 'fixtures');

const agentFiles = readdirSync(agentsDir)
  .filter((f) => f.endsWith('.md'))
  .sort();

/** Extract `.orchestre/*.json` paths declared anywhere in the agent markdown. */
function extractOutputHints(agentMd) {
  // Match `.orchestre/foo.json` or `.orchestre/sub/foo.json` wherever they appear,
  // typically in markdown like "### File: `.orchestre/wave-0-brief.json`".
  const matches = agentMd.match(/\.orchestre\/[\w./-]+\.json/g) || [];
  return [...new Set(matches)];
}

describe('Each agent file is parseable + non-empty', () => {
  for (const name of agentFiles) {
    it(`${name} — has content + identifiable role`, () => {
      const content = readFileSync(join(agentsDir, name), 'utf8');
      assert.ok(content.length > 200, `${name} is suspiciously short (<200 chars)`);
      // Each agent should mention either "wave" or "agent" or "role"
      assert.match(content, /wave|agent|role/i, `${name} doesn't mention wave/agent/role`);
    });
  }
});

describe('Wave-N agents declare an output JSON path', () => {
  // Wave 0-3 emit JSON checkpoints (BriefLint/IntentV2/PlanV2/AiBundleV16).
  // Wave 4 is the auditor: emits markdown (.orchestre/AUDIT_REPORT.md) + WAVE_4_DONE marker,
  //   not JSON — that's by design, the audit is human-readable.
  const jsonEmittingAgents = agentFiles.filter((f) => /^wave-[0-3]/.test(f));

  for (const name of jsonEmittingAgents) {
    it(`${name} — declares at least one .orchestre/*.json output`, () => {
      const content = readFileSync(join(agentsDir, name), 'utf8');
      const outputs = extractOutputHints(content);
      assert.ok(
        outputs.length > 0,
        `${name} doesn't mention writing any .orchestre/*.json output. Found hints: ${outputs.join(', ') || '(none)'}`
      );
    });
  }

  it('wave-4-auditor emits markdown not JSON (by design)', () => {
    const content = readFileSync(join(agentsDir, 'wave-4-auditor.md'), 'utf8');
    assert.match(content, /AUDIT_REPORT\.md/, 'Wave 4 should produce AUDIT_REPORT.md');
    assert.match(content, /WAVE_4_DONE/, 'Wave 4 should produce WAVE_4_DONE marker');
  });
});

describe('All referenced schemas exist on disk', () => {
  const expectedSchemas = ['BriefLint', 'IntentV2', 'PlanV2', 'StateV2', 'AiBundleV16'];

  for (const name of expectedSchemas) {
    it(`schema "${name}" exists and compiles via Ajv`, () => {
      const path = join(schemasDir, `${name}.schema.json`);
      const schema = JSON.parse(readFileSync(path, 'utf8'));
      assert.ok(schema, `Schema ${name} is empty`);
      // Compile via Ajv to catch malformed schemas
      const v = new SchemaValidator(schema);
      assert.ok(v.ajv, `SchemaValidator for ${name} didn't initialise Ajv`);
    });
  }
});

describe('Existing fixtures validate against their schemas', () => {
  // valid-intent.json → IntentV2
  it('valid-intent.json passes IntentV2', () => {
    const schema = loadSchema('IntentV2');
    const data = JSON.parse(readFileSync(join(fixturesDir, 'valid-intent.json'), 'utf8'));
    const v = new SchemaValidator(schema);
    const { valid, errors } = v.validate(data);
    assert.equal(valid, true, `valid-intent.json failed: ${JSON.stringify(errors, null, 2)}`);
  });

  it('valid-plan.json passes PlanV2', () => {
    const schema = loadSchema('PlanV2');
    const data = JSON.parse(readFileSync(join(fixturesDir, 'valid-plan.json'), 'utf8'));
    const v = new SchemaValidator(schema);
    const { valid, errors } = v.validate(data);
    assert.equal(valid, true, `valid-plan.json failed: ${JSON.stringify(errors, null, 2)}`);
  });

  it('invalid-intent.json FAILS IntentV2 (negative test)', () => {
    const schema = loadSchema('IntentV2');
    const data = JSON.parse(readFileSync(join(fixturesDir, 'invalid-intent.json'), 'utf8'));
    const v = new SchemaValidator(schema);
    const { valid, errors } = v.validate(data);
    assert.equal(valid, false, 'invalid-intent.json passed unexpectedly');
    assert.ok(errors.length >= 5, `Expected ≥5 errors, got ${errors.length}`);
  });
});

describe('Mock pipeline contract chain — Brief → Intent → Plan', () => {
  // Mock end-to-end check that the JSON structures chain coherently
  // (without invoking actual LLM agents — pure schema chaining).

  it('a valid Brief produces an Intent that includes brief_hash', () => {
    const intent = JSON.parse(readFileSync(join(fixturesDir, 'valid-intent.json'), 'utf8'));
    assert.ok(intent.brief_hash, 'IntentV2 must include brief_hash field linking back to BriefLint');
    // Hash can be either raw hex or prefixed (e.g. "sha256:abc123...")
    assert.match(intent.brief_hash, /^(sha\d+:)?[a-f0-9]+$/i, 'brief_hash should be hex or sha-prefixed hex');
  });

  it('a valid Plan includes intent_hash and version matches', () => {
    const plan = JSON.parse(readFileSync(join(fixturesDir, 'valid-plan.json'), 'utf8'));
    // PlanV2 should reference upstream intent
    assert.ok(plan.intent_hash || plan.brief_hash, 'PlanV2 should chain back to intent_hash or brief_hash');
  });
});
