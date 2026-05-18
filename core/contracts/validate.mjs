#!/usr/bin/env node
/**
 * Orchestre Contract Validator (v4.0.1+)
 *
 * Powered by Ajv (JSON Schema draft-07 + format support).
 * Replaces the previous hand-rolled validator which only supported a subset
 * of JSON Schema (type/const/enum/required/properties/items/$ref/$defs).
 *
 * Ajv brings: oneOf, anyOf, allOf, if/then/else, format (date-time/uri/email/uuid),
 * patternProperties, dependencies, plus structured error reporting via instancePath.
 *
 * Usage:
 *   node contracts/validate.mjs <schema-name> <json-file>
 *   e.g.: node contracts/validate.mjs IntentV2 .orchestre/intent.json
 *
 * Exit 0 = valid, Exit 1 = validation errors / load errors.
 *
 * Public API (unchanged, backward-compatible):
 *   - SchemaValidator(schema)   class wrapping Ajv
 *   - listSchemas()             string[] of available schema names
 *   - loadSchema(schemaName)    parsed schema object
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Schemas use JSON Schema draft 2020-12 — must import the dedicated Ajv build.
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Wraps Ajv to keep the same public API as the previous hand-rolled validator.
 *   const v = new SchemaValidator(schema);
 *   const { valid, errors } = v.validate(data);
 *   // errors[i] = { path, message }
 */
class SchemaValidator {
  constructor(schema) {
    this.schema = schema;
    this.errors = [];
    // allErrors=true so we collect every issue (not just first).
    // strict=false so legacy schemas with unknown keywords don't crash compile.
    this.ajv = new Ajv({ allErrors: true, strict: false, $data: false });
    addFormats(this.ajv);
    this._validateFn = this.ajv.compile(schema);
  }

  validate(data) {
    const ok = this._validateFn(data);
    if (ok) {
      this.errors = [];
      return { valid: true, errors: [] };
    }
    this.errors = (this._validateFn.errors || []).map(this._formatError);
    return { valid: false, errors: this.errors };
  }

  /** Convert Ajv error shape to {path, message} used elsewhere in the codebase. */
  _formatError(err) {
    const path = err.instancePath || '';
    let msg = err.message || 'validation error';
    if (err.params && Object.keys(err.params).length > 0) {
      const paramsStr = Object.entries(err.params)
        .map(([k, v]) => `${k}=${Array.isArray(v) ? `[${v.join(',')}]` : v}`)
        .join(', ');
      msg = `${msg} (${paramsStr})`;
    }
    return { path, message: msg };
  }
}

/** List available schema names (no .schema.json suffix). */
function listSchemas() {
  const schemasDir = join(__dirname, 'schemas');
  try {
    return readdirSync(schemasDir)
      .filter((f) => f.endsWith('.schema.json'))
      .map((f) => f.replace('.schema.json', ''));
  } catch {
    return [];
  }
}

/** Load and parse a schema file by name. */
function loadSchema(schemaName) {
  const schemaPath = join(__dirname, 'schemas', `${schemaName}.schema.json`);
  return JSON.parse(readFileSync(schemaPath, 'utf8'));
}

export { SchemaValidator, listSchemas, loadSchema };

// ─────────────────────────────────────────────────────────────────────
// CLI entry — only when invoked directly
// ─────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , schemaName, jsonFile] = process.argv;

  if (!schemaName || !jsonFile) {
    console.error('Usage: node contracts/validate.mjs <schema-name> <json-file>');
    console.error(`Available schemas: ${listSchemas().join(', ') || '(none found)'}`);
    process.exit(1);
  }

  let schema, data;
  try {
    schema = loadSchema(schemaName);
  } catch (err) {
    console.error(`Failed to load schema "${schemaName}": ${err.message}`);
    console.error(`Available schemas: ${listSchemas().join(', ')}`);
    process.exit(1);
  }

  try {
    data = JSON.parse(readFileSync(jsonFile, 'utf8'));
  } catch (err) {
    console.error(`Failed to load JSON file "${jsonFile}": ${err.message}`);
    process.exit(1);
  }

  let validator;
  try {
    validator = new SchemaValidator(schema);
  } catch (err) {
    console.error(`Failed to compile schema "${schemaName}": ${err.message}`);
    process.exit(1);
  }

  const result = validator.validate(data);

  if (result.valid) {
    console.log(`✓ ${jsonFile} is valid against ${schemaName}`);
    process.exit(0);
  } else {
    console.error(`✗ ${jsonFile} failed validation against ${schemaName}:`);
    for (const err of result.errors) {
      console.error(`  ${err.path || '(root)'}: ${err.message}`);
    }
    process.exit(1);
  }
}
