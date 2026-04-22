import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { init, append, read, snapshot, rebuildSnapshot } from '../../core/runtime/state-store.mjs';

let root;

beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'orchestre-state-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe('state-store', () => {
  it('creates .orchestre/state/ with empty events + default snapshot on init', () => {
    const p = init(root);
    assert.ok(existsSync(p.events));
    assert.ok(existsSync(p.snapshot));
    const snap = snapshot(root);
    assert.equal(snap.eventCount, 0);
    assert.equal(snap.costSoFar.usd, 0);
    assert.deepEqual(snap.byWave, {});
  });

  it('append() adds ts if missing and persists the event', () => {
    init(root);
    append(root, { type: 'turn', wave: 1 });
    const events = read(root);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'turn');
    assert.ok(events[0].ts);
  });

  it('rejects events without a type', () => {
    init(root);
    assert.throws(() => append(root, { wave: 1 }), /event\.type is required/);
  });

  it('reduces cost events into costSoFar cumulatively', () => {
    init(root);
    append(root, { type: 'cost', wave: 1, data: { usd: 0.20, tokens_in: 1000, tokens_out: 500 } });
    append(root, { type: 'cost', wave: 1, data: { usd: 0.05, tokens_in: 200, tokens_out: 100 } });
    const snap = snapshot(root);
    assert.equal(snap.costSoFar.usd, 0.25);
    assert.equal(snap.costSoFar.tokens_in, 1200);
    assert.equal(snap.costSoFar.tokens_out, 600);
    assert.equal(snap.byWave[1].cost_usd, 0.25);
  });

  it('counts turns and tracks activeWave', () => {
    init(root);
    append(root, { type: 'wave_start', wave: 2 });
    append(root, { type: 'turn', wave: 2 });
    append(root, { type: 'turn', wave: 2 });
    const snap = snapshot(root);
    assert.equal(snap.activeWave, 2);
    assert.equal(snap.turnCount, 2);
    assert.equal(snap.byWave[2].turns, 2);
  });

  it('filters events by wave and type in read()', () => {
    init(root);
    append(root, { type: 'turn', wave: 0 });
    append(root, { type: 'cost', wave: 0, data: { usd: 0.01 } });
    append(root, { type: 'turn', wave: 1 });
    assert.equal(read(root, { wave: 0 }).length, 2);
    assert.equal(read(root, { type: 'cost' }).length, 1);
    assert.equal(read(root, { wave: 1, type: 'turn' }).length, 1);
  });

  it('rebuildSnapshot() reconstructs snapshot from events (crash recovery)', () => {
    init(root);
    append(root, { type: 'cost', wave: 0, data: { usd: 0.10 } });
    append(root, { type: 'cost', wave: 1, data: { usd: 0.30 } });
    const { snapshot: snapPath } = init(root);
    writeFileSync(snapPath, '{ this is corrupt }');
    const rebuilt = rebuildSnapshot(root);
    assert.equal(rebuilt.costSoFar.usd, 0.40);
    assert.equal(rebuilt.eventCount, 2);
  });

  it('recovers gracefully if snapshot.json is corrupted on read', () => {
    init(root);
    append(root, { type: 'cost', wave: 0, data: { usd: 0.10 } });
    const p = init(root);
    writeFileSync(p.snapshot, '{{not json');
    const snap = snapshot(root);
    assert.equal(snap.costSoFar.usd, 0.10);
  });

  it('persists wave_end with stop_reason', () => {
    init(root);
    append(root, { type: 'wave_start', wave: 3 });
    append(root, { type: 'wave_end', wave: 3, data: { stop_reason: 'budget_exceeded' } });
    const snap = snapshot(root);
    assert.equal(snap.byWave[3].stop_reason, 'budget_exceeded');
    assert.ok(snap.byWave[3].started_at);
    assert.ok(snap.byWave[3].ended_at);
  });

  it('events.jsonl is append-only (previous writes preserved across appends)', () => {
    init(root);
    append(root, { type: 'turn', wave: 0 });
    const raw1 = readFileSync(join(root, '.orchestre', 'state', 'events.jsonl'), 'utf8');
    append(root, { type: 'turn', wave: 0 });
    const raw2 = readFileSync(join(root, '.orchestre', 'state', 'events.jsonl'), 'utf8');
    assert.ok(raw2.startsWith(raw1));
    assert.equal(raw2.trim().split('\n').length, 2);
  });
});
