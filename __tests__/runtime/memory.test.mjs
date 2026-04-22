import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { init, read } from '../../core/runtime/state-store.mjs';
import {
  DEFAULT_THRESHOLD, getLearnedPatterns, recordRejection,
  renderLearnedMarkdown, updateLearnedPatternsFile,
} from '../../core/runtime/memory.mjs';

let project;
let repo;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'orchestre-mem-'));
  repo = mkdtempSync(join(tmpdir(), 'orchestre-repo-'));
  init(project);
});
afterEach(() => {
  rmSync(project, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

describe('memory — recordRejection', () => {
  it('persists rejection event with pattern + context + reason', () => {
    recordRejection(project, {
      pattern: 'throw-in-lib',
      context: 'lib/queries/',
      reason: 'lib should return Result<T>, not throw',
      wave: 4,
    });
    const events = read(project, { type: 'rejection' });
    assert.equal(events.length, 1);
    assert.equal(events[0].data.pattern, 'throw-in-lib');
    assert.equal(events[0].wave, 4);
  });

  it('throws when pattern is missing', () => {
    assert.throws(() => recordRejection(project, { reason: 'x' }), /pattern is required/);
  });
});

describe('memory — getLearnedPatterns', () => {
  it('returns nothing below threshold', () => {
    recordRejection(project, { pattern: 'p1', wave: 4 });
    recordRejection(project, { pattern: 'p1', wave: 4 });
    assert.deepEqual(getLearnedPatterns(project, { threshold: 3 }), []);
  });

  it('aggregates by pattern, counts, and sorts by count desc', () => {
    recordRejection(project, { pattern: 'A', reason: 'r1', wave: 4 });
    recordRejection(project, { pattern: 'A', reason: 'r2', wave: 4 });
    recordRejection(project, { pattern: 'A', reason: 'r1', wave: 4 });
    recordRejection(project, { pattern: 'B', context: 'app/', reason: 'r3', wave: 4 });
    recordRejection(project, { pattern: 'B', context: 'app/', wave: 4 });
    recordRejection(project, { pattern: 'B', context: 'components/', wave: 4 });
    recordRejection(project, { pattern: 'B', wave: 4 });
    recordRejection(project, { pattern: 'C', wave: 4 }); // count=1, below threshold

    const learned = getLearnedPatterns(project, { threshold: 3 });
    assert.equal(learned.length, 2);
    assert.equal(learned[0].pattern, 'B'); // highest count first
    assert.equal(learned[0].count, 4);
    assert.deepEqual([...learned[0].contexts].sort(), ['app/', 'components/']);
    assert.equal(learned[1].pattern, 'A');
    assert.equal(learned[1].count, 3);
    assert.deepEqual([...learned[1].reasons].sort(), ['r1', 'r2']); // dedup
  });

  it('default threshold is 3', () => {
    recordRejection(project, { pattern: 'X', wave: 4 });
    recordRejection(project, { pattern: 'X', wave: 4 });
    assert.equal(getLearnedPatterns(project).length, 0);
    recordRejection(project, { pattern: 'X', wave: 4 });
    assert.equal(getLearnedPatterns(project).length, 1);
    assert.equal(DEFAULT_THRESHOLD, 3);
  });
});

describe('memory — renderLearnedMarkdown', () => {
  it('returns stable header + placeholder when no learned patterns', () => {
    const md = renderLearnedMarkdown(project, { threshold: 3 });
    assert.match(md, /# Learned Patterns/);
    assert.match(md, /_No learned patterns yet\._/);
  });

  it('sections are sorted by count and include contexts/reasons', () => {
    for (let i = 0; i < 4; i++) recordRejection(project, { pattern: 'db-in-component', context: 'app/', reason: 'use lib/queries' });
    for (let i = 0; i < 3; i++) recordRejection(project, { pattern: 'any-type', reason: 'use unknown' });

    const md = renderLearnedMarkdown(project, { threshold: 3 });
    const dbIdx = md.indexOf('db-in-component');
    const anyIdx = md.indexOf('any-type');
    assert.ok(dbIdx > 0 && anyIdx > 0);
    assert.ok(dbIdx < anyIdx, 'higher count must render first');
    assert.match(md, /Rejected \*\*4\*\* times/);
    assert.match(md, /`app\/`/);
    assert.match(md, /use lib\/queries/);
  });
});

describe('memory — updateLearnedPatternsFile', () => {
  it('writes core/memory/learned-patterns.md under repoRoot by default', () => {
    for (let i = 0; i < 3; i++) recordRejection(project, { pattern: 'X', reason: 'y' });
    const result = updateLearnedPatternsFile(repo, project);
    assert.equal(result.updated, true);
    assert.equal(result.count, 1);
    assert.ok(existsSync(result.path));
    assert.ok(result.path.endsWith('core/memory/learned-patterns.md'));
    assert.match(readFileSync(result.path, 'utf8'), /X/);
  });

  it('no-op when content has not changed (updated=false)', () => {
    for (let i = 0; i < 3; i++) recordRejection(project, { pattern: 'X' });
    const first = updateLearnedPatternsFile(repo, project);
    const second = updateLearnedPatternsFile(repo, project);
    assert.equal(first.updated, true);
    assert.equal(second.updated, false);
  });

  it('writes to a custom filePath when provided (atomic rename)', () => {
    recordRejection(project, { pattern: 'Y' });
    recordRejection(project, { pattern: 'Y' });
    recordRejection(project, { pattern: 'Y' });
    const custom = join(repo, 'docs', 'patterns.md');
    const r = updateLearnedPatternsFile(repo, project, { filePath: custom });
    assert.equal(r.path, custom);
    assert.ok(existsSync(custom));
  });

  it('re-renders when patterns cross the threshold', () => {
    recordRejection(project, { pattern: 'Z' });
    recordRejection(project, { pattern: 'Z' });
    const before = updateLearnedPatternsFile(repo, project, { threshold: 3 });
    assert.equal(before.count, 0);
    recordRejection(project, { pattern: 'Z' });
    const after = updateLearnedPatternsFile(repo, project, { threshold: 3 });
    assert.equal(after.count, 1);
    assert.equal(after.updated, true);
  });
});
