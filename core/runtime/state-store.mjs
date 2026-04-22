/**
 * State Store — Append-only event log + derived snapshot.
 *
 * Converts core/infrastructure/session-store.md + cost-tracker.md into runtime.
 * Writes to .orchestre/state/ :
 *   - events.jsonl   (append-only, one JSON event per line)
 *   - snapshot.json  (reconstructed after each append, single source of truth for reads)
 *
 * Events are the authoritative history. Snapshot is a cache — deletable and rebuildable.
 * Concurrent appenders are serialized by O_APPEND on POSIX. Snapshot writes use atomic rename.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_SNAPSHOT = Object.freeze({
  activeWave: null,
  turnCount: 0,
  costSoFar: { usd: 0, tokens_in: 0, tokens_out: 0 },
  byWave: {},
  lastEventTs: null,
  eventCount: 0,
});

function stateDir(projectRoot) {
  return join(projectRoot, '.orchestre', 'state');
}

function paths(projectRoot) {
  const dir = stateDir(projectRoot);
  return {
    dir,
    events: join(dir, 'events.jsonl'),
    snapshot: join(dir, 'snapshot.json'),
    snapshotTmp: join(dir, 'snapshot.json.tmp'),
  };
}

export function init(projectRoot) {
  const { dir, events, snapshot } = paths(projectRoot);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(events)) writeFileSync(events, '');
  if (!existsSync(snapshot)) writeFileSync(snapshot, JSON.stringify(DEFAULT_SNAPSHOT, null, 2));
  return paths(projectRoot);
}

export function append(projectRoot, event) {
  if (!event || typeof event !== 'object') throw new TypeError('event must be an object');
  if (typeof event.type !== 'string' || !event.type) throw new TypeError('event.type is required');

  const { events, snapshot, snapshotTmp } = init(projectRoot);
  const sealed = { ts: event.ts || new Date().toISOString(), ...event };
  appendFileSync(events, JSON.stringify(sealed) + '\n');

  const current = readSnapshot(projectRoot);
  const next = reduce(current, sealed);
  writeFileSync(snapshotTmp, JSON.stringify(next, null, 2));
  renameSync(snapshotTmp, snapshot);
  return sealed;
}

export function read(projectRoot, filter) {
  const { events } = paths(projectRoot);
  if (!existsSync(events)) return [];
  const raw = readFileSync(events, 'utf8');
  if (!raw) return [];
  const parsed = raw.split('\n').filter(Boolean).map(line => JSON.parse(line));
  if (!filter) return parsed;
  return parsed.filter(e => {
    if (filter.wave !== undefined && e.wave !== filter.wave) return false;
    if (filter.type && e.type !== filter.type) return false;
    return true;
  });
}

export function snapshot(projectRoot) {
  return readSnapshot(projectRoot);
}

export function rebuildSnapshot(projectRoot) {
  const events = read(projectRoot);
  const { snapshot: snapPath, snapshotTmp } = paths(projectRoot);
  const state = events.reduce(reduce, { ...DEFAULT_SNAPSHOT, byWave: {}, costSoFar: { ...DEFAULT_SNAPSHOT.costSoFar } });
  writeFileSync(snapshotTmp, JSON.stringify(state, null, 2));
  renameSync(snapshotTmp, snapPath);
  return state;
}

function readSnapshot(projectRoot) {
  const { snapshot: snapPath } = paths(projectRoot);
  if (!existsSync(snapPath)) return { ...DEFAULT_SNAPSHOT, byWave: {}, costSoFar: { ...DEFAULT_SNAPSHOT.costSoFar } };
  try {
    return JSON.parse(readFileSync(snapPath, 'utf8'));
  } catch {
    return rebuildSnapshot(projectRoot);
  }
}

function reduce(state, event) {
  const next = {
    ...state,
    byWave: { ...state.byWave },
    costSoFar: { ...state.costSoFar },
    lastEventTs: event.ts,
    eventCount: (state.eventCount || 0) + 1,
  };

  if (event.wave !== undefined && event.wave !== null) next.activeWave = event.wave;

  if (event.type === 'turn') {
    next.turnCount = (state.turnCount || 0) + 1;
    if (event.wave !== undefined) {
      const w = next.byWave[event.wave] || { turns: 0, cost_usd: 0, tokens_in: 0, tokens_out: 0 };
      const tIn = Number(event.data?.tokens_in) || 0;
      const tOut = Number(event.data?.tokens_out) || 0;
      next.byWave[event.wave] = {
        ...w,
        turns: w.turns + 1,
        tokens_in: (w.tokens_in || 0) + tIn,
        tokens_out: (w.tokens_out || 0) + tOut,
      };
    }
  }

  if (event.type === 'cost') {
    const usd = Number(event.data?.usd) || 0;
    const tIn = Number(event.data?.tokens_in) || 0;
    const tOut = Number(event.data?.tokens_out) || 0;
    next.costSoFar = {
      usd: state.costSoFar.usd + usd,
      tokens_in: state.costSoFar.tokens_in + tIn,
      tokens_out: state.costSoFar.tokens_out + tOut,
    };
    if (event.wave !== undefined) {
      const w = next.byWave[event.wave] || { turns: 0, cost_usd: 0, tokens_in: 0, tokens_out: 0 };
      next.byWave[event.wave] = {
        ...w,
        cost_usd: (w.cost_usd || 0) + usd,
        tokens_in: (w.tokens_in || 0) + tIn,
        tokens_out: (w.tokens_out || 0) + tOut,
      };
    }
  }

  if (event.type === 'wave_start' && event.wave !== undefined) {
    next.activeWave = event.wave;
    if (!next.byWave[event.wave]) next.byWave[event.wave] = { turns: 0, cost_usd: 0, tokens_in: 0, tokens_out: 0 };
    next.byWave[event.wave].started_at = event.ts;
  }

  if (event.type === 'wave_end' && event.wave !== undefined) {
    const w = next.byWave[event.wave] || { turns: 0, cost_usd: 0, tokens_in: 0, tokens_out: 0 };
    next.byWave[event.wave] = { ...w, ended_at: event.ts, stop_reason: event.data?.stop_reason || 'completed' };
  }

  return next;
}
