import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemasDir = join(__dirname, '..', '..', 'core', 'contracts', 'schemas');

describe('schema coherence', () => {
  const schemaFiles = readdirSync(schemasDir).filter(f => f.endsWith('.schema.json'));

  it('has at least 4 schema files', () => {
    assert.ok(schemaFiles.length >= 4, `Found only ${schemaFiles.length} schemas`);
  });

  for (const file of schemaFiles) {
    it(`${file} is valid JSON`, () => {
      const content = readFileSync(join(schemasDir, file), 'utf8');
      const schema = JSON.parse(content); // Throws if invalid
      assert.ok(schema.$schema || schema.title, `${file} missing $schema or title`);
    });

    it(`${file} has a title`, () => {
      const schema = JSON.parse(readFileSync(join(schemasDir, file), 'utf8'));
      assert.ok(schema.title, `${file} missing title`);
    });

    it(`${file} has required fields or properties`, () => {
      const schema = JSON.parse(readFileSync(join(schemasDir, file), 'utf8'));
      assert.ok(schema.required || schema.properties, `${file} has neither required nor properties`);
    });

    it(`${file} $refs resolve to existing $defs`, () => {
      const schema = JSON.parse(readFileSync(join(schemasDir, file), 'utf8'));
      const refs = findRefs(schema);
      const defs = schema.$defs ? Object.keys(schema.$defs) : [];
      for (const ref of refs) {
        const defName = ref.replace('#/$defs/', '');
        assert.ok(defs.includes(defName), `${file}: $ref "${ref}" has no matching $def`);
      }
    });
  }
});

function findRefs(obj, refs = []) {
  if (typeof obj !== 'object' || obj === null) return refs;
  if (obj.$ref && obj.$ref.startsWith('#/$defs/')) {
    refs.push(obj.$ref);
  }
  for (const val of Object.values(obj)) {
    findRefs(val, refs);
  }
  return refs;
}
