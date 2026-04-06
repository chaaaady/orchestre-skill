#!/usr/bin/env node
/**
 * Orchestre Contract Validator
 * Usage: node contracts/validate.mjs <schema-name> <json-file>
 * Example: node contracts/validate.mjs IntentV2 .orchestre/intent.json
 *
 * Exit 0 = valid, Exit 1 = validation errors
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Lightweight JSON Schema validator (no external deps)
// Supports: type, required, properties, enum, const, pattern, minimum, maximum,
// minLength, maxLength, minItems, items, additionalProperties, $ref, $defs, format
class SchemaValidator {
  constructor(schema) {
    this.schema = schema;
    this.errors = [];
  }

  validate(data) {
    this.errors = [];
    this._validate(data, this.schema, '');
    return { valid: this.errors.length === 0, errors: this.errors };
  }

  _validate(data, schema, path) {
    if (!schema || typeof schema !== 'object') return;

    // Resolve $ref
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/$defs/', '');
      const resolved = this.schema.$defs?.[refPath];
      if (resolved) {
        this._validate(data, resolved, path);
      } else {
        this.errors.push({ path, message: `Unresolved $ref: ${schema.$ref}` });
      }
      return;
    }

    // const
    if (schema.const !== undefined && data !== schema.const) {
      this.errors.push({ path, message: `Expected const "${schema.const}", got "${data}"` });
      return;
    }

    // type check
    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      const actualType = data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data;
      const intMatch = types.includes('integer') && typeof data === 'number' && Number.isInteger(data);
      if (!types.includes(actualType) && !intMatch) {
        this.errors.push({ path, message: `Expected type ${types.join('|')}, got ${actualType}` });
        return;
      }
    }

    // enum
    if (schema.enum && !schema.enum.includes(data)) {
      this.errors.push({ path, message: `Value "${data}" not in enum [${schema.enum.join(', ')}]` });
    }

    // string validations
    if (typeof data === 'string') {
      if (schema.minLength !== undefined && data.length < schema.minLength) {
        this.errors.push({ path, message: `String length ${data.length} < minLength ${schema.minLength}` });
      }
      if (schema.maxLength !== undefined && data.length > schema.maxLength) {
        this.errors.push({ path, message: `String length ${data.length} > maxLength ${schema.maxLength}` });
      }
      if (schema.pattern) {
        const re = new RegExp(schema.pattern);
        if (!re.test(data)) {
          this.errors.push({ path, message: `String "${data.substring(0, 50)}" does not match pattern ${schema.pattern}` });
        }
      }
    }

    // number validations
    if (typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) {
        this.errors.push({ path, message: `Value ${data} < minimum ${schema.minimum}` });
      }
      if (schema.maximum !== undefined && data > schema.maximum) {
        this.errors.push({ path, message: `Value ${data} > maximum ${schema.maximum}` });
      }
    }

    // object validations
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      if (schema.required) {
        for (const key of schema.required) {
          if (!(key in data)) {
            this.errors.push({ path: `${path}.${key}`, message: `Missing required property "${key}"` });
          }
        }
      }
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in data) {
            this._validate(data[key], propSchema, `${path}.${key}`);
          }
        }
      }
      if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        for (const [key, val] of Object.entries(data)) {
          if (!schema.properties || !(key in schema.properties)) {
            this._validate(val, schema.additionalProperties, `${path}.${key}`);
          }
        }
      }
    }

    // array validations
    if (Array.isArray(data)) {
      if (schema.minItems !== undefined && data.length < schema.minItems) {
        this.errors.push({ path, message: `Array length ${data.length} < minItems ${schema.minItems}` });
      }
      if (schema.items) {
        data.forEach((item, i) => {
          this._validate(item, schema.items, `${path}[${i}]`);
        });
      }
    }
  }
}

// List available schemas
function listSchemas() {
  const schemasDir = join(__dirname, 'schemas');
  try {
    return readdirSync(schemasDir)
      .filter(f => f.endsWith('.schema.json'))
      .map(f => f.replace('.schema.json', ''));
  } catch {
    return [];
  }
}

// Main
const [,, schemaName, jsonFile] = process.argv;

if (!schemaName || !jsonFile) {
  console.error('Usage: node contracts/validate.mjs <schema-name> <json-file>');
  console.error(`Available schemas: ${listSchemas().join(', ') || '(none found)'}`);
  process.exit(1);
}

const schemaPath = join(__dirname, 'schemas', `${schemaName}.schema.json`);

let schema, data;
try {
  schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
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

const validator = new SchemaValidator(schema);
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
