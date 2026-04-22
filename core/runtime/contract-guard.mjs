/**
 * Contract Guard — runtime validation at wave boundaries.
 *
 * Wraps core/contracts/validate.mjs (SchemaValidator + loadSchema) with:
 *   - validateContract(name, data)  — pure, returns {valid, errors}
 *   - assertContract(root, name, data, {wave, label})
 *       → throws ContractViolationError + persists 'contract_violation' event
 *
 * Schemas are cached after first load. Unknown schema = fail-fast at assert,
 * silent pass at validateContract (returns valid=true so the harness is permissive
 * when schemas are optional).
 */
import { append } from './state-store.mjs';
import { SchemaValidator, loadSchema, listSchemas } from '../contracts/validate.mjs';

const schemaCache = new Map();

export class ContractViolationError extends Error {
  constructor({ name, errors, wave, label }) {
    const summary = errors.slice(0, 3).map(e => `${e.path || '(root)'}: ${e.message}`).join('; ');
    super(`Contract "${name}" failed (${errors.length} error${errors.length === 1 ? '' : 's'}): ${summary}`);
    this.name = 'ContractViolationError';
    this.contractName = name;
    this.errors = errors;
    this.wave = wave ?? null;
    this.label = label ?? null;
  }
}

export function availableContracts() {
  return listSchemas();
}

function getSchema(name) {
  if (schemaCache.has(name)) return schemaCache.get(name);
  try {
    const s = loadSchema(name);
    schemaCache.set(name, s);
    return s;
  } catch {
    schemaCache.set(name, null);
    return null;
  }
}

export function validateContract(name, data) {
  const schema = getSchema(name);
  if (!schema) return { valid: true, errors: [], unknown: true };
  const result = new SchemaValidator(schema).validate(data);
  return { valid: result.valid, errors: result.errors, unknown: false };
}

export function assertContract(projectRoot, name, data, { wave, label } = {}) {
  const result = validateContract(name, data);
  if (result.unknown) {
    throw new ContractViolationError({
      name, errors: [{ path: '', message: `Unknown contract "${name}" — available: ${availableContracts().join(', ')}` }],
      wave, label,
    });
  }
  if (!result.valid) {
    try {
      append(projectRoot, {
        type: 'contract_violation',
        wave: typeof wave === 'number' ? wave : null,
        data: { contract: name, label: label || null, error_count: result.errors.length, first_error: result.errors[0] || null },
      });
    } catch {}
    throw new ContractViolationError({ name, errors: result.errors, wave, label });
  }
  return { valid: true };
}

export function clearCache() { schemaCache.clear(); }
