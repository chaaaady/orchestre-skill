import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaValidator } from '../../core/contracts/validate.mjs';

/**
 * v4.0.1+ — Ajv extras tests
 *
 * The hand-rolled validator in pre-v4.0.1 only supported:
 *   type, const, enum, required, properties, items, $ref, $defs,
 *   pattern, min/maxLength, minimum, maximum, minItems, additionalProperties
 *
 * Switching to Ajv brings: oneOf, anyOf, allOf, if/then/else, format, dependencies.
 * These tests document and guard those new capabilities.
 */

describe('Ajv extras — oneOf', () => {
  const schema = {
    type: 'object',
    properties: {
      payment: {
        oneOf: [
          { type: 'object', properties: { kind: { const: 'card' }, last4: { type: 'string' } }, required: ['kind', 'last4'] },
          { type: 'object', properties: { kind: { const: 'bank' }, iban: { type: 'string' } }, required: ['kind', 'iban'] },
        ],
      },
    },
  };

  it('accepts a valid card payment', () => {
    const v = new SchemaValidator(schema);
    const { valid } = v.validate({ payment: { kind: 'card', last4: '4242' } });
    assert.equal(valid, true);
  });

  it('accepts a valid bank payment', () => {
    const v = new SchemaValidator(schema);
    const { valid } = v.validate({ payment: { kind: 'bank', iban: 'FR76...' } });
    assert.equal(valid, true);
  });

  it('rejects a payment with mixed shape', () => {
    const v = new SchemaValidator(schema);
    const { valid, errors } = v.validate({ payment: { kind: 'card', iban: 'FR76...' } });
    assert.equal(valid, false);
    assert.ok(errors.length > 0);
  });
});

describe('Ajv extras — anyOf', () => {
  const schema = {
    anyOf: [
      { type: 'string', minLength: 3 },
      { type: 'integer', minimum: 1 },
    ],
  };

  it('accepts a string ≥3 chars', () => {
    const v = new SchemaValidator(schema);
    assert.equal(v.validate('hello').valid, true);
  });

  it('accepts a positive integer', () => {
    const v = new SchemaValidator(schema);
    assert.equal(v.validate(42).valid, true);
  });

  it('rejects a short string AND boolean', () => {
    const v = new SchemaValidator(schema);
    assert.equal(v.validate('ab').valid, false);
    assert.equal(v.validate(true).valid, false);
  });
});

describe('Ajv extras — allOf', () => {
  const schema = {
    allOf: [
      { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      { type: 'object', properties: { age: { type: 'integer', minimum: 0 } }, required: ['age'] },
    ],
  };

  it('accepts an object matching both', () => {
    const v = new SchemaValidator(schema);
    assert.equal(v.validate({ name: 'Alice', age: 30 }).valid, true);
  });

  it('rejects an object missing one constraint', () => {
    const v = new SchemaValidator(schema);
    assert.equal(v.validate({ name: 'Alice' }).valid, false);
  });
});

describe('Ajv extras — format (date-time, email, uri, uuid)', () => {
  it('validates date-time', () => {
    const schema = { type: 'string', format: 'date-time' };
    const v = new SchemaValidator(schema);
    assert.equal(v.validate('2026-05-18T12:34:56Z').valid, true);
    assert.equal(v.validate('not-a-date').valid, false);
  });

  it('validates email', () => {
    const schema = { type: 'string', format: 'email' };
    const v = new SchemaValidator(schema);
    assert.equal(v.validate('chady@example.com').valid, true);
    assert.equal(v.validate('not-an-email').valid, false);
  });

  it('validates uri', () => {
    const schema = { type: 'string', format: 'uri' };
    const v = new SchemaValidator(schema);
    assert.equal(v.validate('https://example.com/path?x=1').valid, true);
    assert.equal(v.validate('not a uri').valid, false);
  });

  it('validates uuid', () => {
    const schema = { type: 'string', format: 'uuid' };
    const v = new SchemaValidator(schema);
    assert.equal(v.validate('550e8400-e29b-41d4-a716-446655440000').valid, true);
    assert.equal(v.validate('not-a-uuid').valid, false);
  });
});

describe('Ajv extras — if/then/else', () => {
  const schema = {
    type: 'object',
    properties: { country: { type: 'string' }, postcode: { type: 'string' } },
    if: { properties: { country: { const: 'FR' } } },
    then: { properties: { postcode: { pattern: '^\\d{5}$' } } },
    else: { properties: { postcode: { type: 'string', minLength: 1 } } },
  };

  it('enforces FR postcode pattern when country=FR', () => {
    const v = new SchemaValidator(schema);
    assert.equal(v.validate({ country: 'FR', postcode: '75001' }).valid, true);
    assert.equal(v.validate({ country: 'FR', postcode: 'ABC' }).valid, false);
  });

  it('relaxes postcode pattern when country!=FR', () => {
    const v = new SchemaValidator(schema);
    assert.equal(v.validate({ country: 'US', postcode: 'ABC123' }).valid, true);
  });
});

describe('Ajv extras — error format (instancePath + params)', () => {
  it('returns {path, message} including readable params', () => {
    const schema = {
      type: 'object',
      properties: { age: { type: 'integer', minimum: 18 } },
      required: ['age'],
    };
    const v = new SchemaValidator(schema);
    const { valid, errors } = v.validate({ age: 12 });
    assert.equal(valid, false);
    assert.ok(errors.length > 0);
    assert.equal(errors[0].path, '/age');
    assert.match(errors[0].message, /must be >= 18|comparison=>=, limit=18/);
  });
});
