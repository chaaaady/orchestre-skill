import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemasDir = join(__dirname, '..', '..', 'contracts', 'schemas');
const fixturesDir = join(__dirname, '..', 'fixtures');

// Inline the validator to avoid import issues
class SchemaValidator {
  constructor(schema) { this.schema = schema; this.errors = []; }
  validate(data) {
    this.errors = [];
    this._validate(data, this.schema, '');
    return { valid: this.errors.length === 0, errors: this.errors };
  }
  _validate(data, schema, path) {
    if (!schema || typeof schema !== 'object') return;
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/$defs/', '');
      const resolved = this.schema.$defs?.[refPath];
      if (resolved) this._validate(data, resolved, path);
      return;
    }
    if (schema.const !== undefined && data !== schema.const) {
      this.errors.push({ path, message: `Expected const "${schema.const}", got "${data}"` });
      return;
    }
    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      const actualType = data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data;
      const intMatch = types.includes('integer') && typeof data === 'number' && Number.isInteger(data);
      if (!types.includes(actualType) && !intMatch) {
        this.errors.push({ path, message: `Expected type ${types.join('|')}, got ${actualType}` }); return;
      }
    }
    if (schema.enum && !schema.enum.includes(data)) {
      this.errors.push({ path, message: `Value not in enum` });
    }
    if (typeof data === 'string') {
      if (schema.minLength !== undefined && data.length < schema.minLength) this.errors.push({ path, message: `Too short` });
      if (schema.pattern && !new RegExp(schema.pattern).test(data)) this.errors.push({ path, message: `Pattern mismatch` });
    }
    if (typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) this.errors.push({ path, message: `Below minimum` });
    }
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      if (schema.required) {
        for (const key of schema.required) {
          if (!(key in data)) this.errors.push({ path: `${path}.${key}`, message: `Missing required` });
        }
      }
      if (schema.properties) {
        for (const [key, ps] of Object.entries(schema.properties)) {
          if (key in data) this._validate(data[key], ps, `${path}.${key}`);
        }
      }
      if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        for (const [key, val] of Object.entries(data)) {
          if (!schema.properties || !(key in schema.properties)) this._validate(val, schema.additionalProperties, `${path}.${key}`);
        }
      }
    }
    if (Array.isArray(data)) {
      if (schema.minItems !== undefined && data.length < schema.minItems) this.errors.push({ path, message: `Array too short` });
      if (schema.items) data.forEach((item, i) => this._validate(item, schema.items, `${path}[${i}]`));
    }
  }
}

describe('validate fixtures', () => {
  it('valid-intent.json passes IntentV2 schema', () => {
    const schema = JSON.parse(readFileSync(join(schemasDir, 'IntentV2.schema.json'), 'utf8'));
    const data = JSON.parse(readFileSync(join(fixturesDir, 'valid-intent.json'), 'utf8'));
    const result = new SchemaValidator(schema).validate(data);
    assert.ok(result.valid, `Validation errors: ${JSON.stringify(result.errors)}`);
  });

  it('invalid-intent.json fails IntentV2 schema', () => {
    const schema = JSON.parse(readFileSync(join(schemasDir, 'IntentV2.schema.json'), 'utf8'));
    const data = JSON.parse(readFileSync(join(fixturesDir, 'invalid-intent.json'), 'utf8'));
    const result = new SchemaValidator(schema).validate(data);
    assert.ok(!result.valid, 'Expected validation to fail');
    assert.ok(result.errors.length > 0);
  });

  it('valid-plan.json passes PlanV2 schema', () => {
    const schema = JSON.parse(readFileSync(join(schemasDir, 'PlanV2.schema.json'), 'utf8'));
    const data = JSON.parse(readFileSync(join(fixturesDir, 'valid-plan.json'), 'utf8'));
    const result = new SchemaValidator(schema).validate(data);
    assert.ok(result.valid, `Validation errors: ${JSON.stringify(result.errors)}`);
  });
});
