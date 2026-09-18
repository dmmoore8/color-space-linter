import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { lintSource } from './linter.js';

// Compiled output lands in dist/, one level below the repo root that
// fixtures/ lives in, so this holds regardless of the caller's cwd.
const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

interface Hit {
  line: number;
  ruleId: string;
}

function findingsOf(fixture: string): Hit[] {
  const source = readFileSync(path.join(fixturesDir, fixture), 'utf8');
  return lintSource(fixture, source, { lenient: false }).findings.map((finding) => ({
    line: finding.line,
    ruleId: finding.ruleId,
  }));
}

test('hex-length catches malformed hex digit counts', () => {
  assert.deepEqual(findingsOf('bad-hex.css'), [
    { line: 2, ruleId: 'hex-length' },
    { line: 3, ruleId: 'hex-length' },
    { line: 4, ruleId: 'hex-length' },
  ]);
});

test('rgb-range and channel-mix catch bad rgb() usage', () => {
  assert.deepEqual(findingsOf('bad-rgb.css'), [
    { line: 2, ruleId: 'channel-mix' },
    { line: 3, ruleId: 'rgb-range' },
    { line: 4, ruleId: 'rgb-range' },
    { line: 5, ruleId: 'rgb-range' },
  ]);
});

test('hue-range catches wraparound across hsl/hwb/lch/oklch', () => {
  assert.deepEqual(findingsOf('bad-hue.css'), [
    { line: 2, ruleId: 'hue-range' },
    { line: 3, ruleId: 'hue-range' },
    { line: 4, ruleId: 'hue-range' },
    { line: 5, ruleId: 'hue-range' },
    { line: 6, ruleId: 'hue-range' },
  ]);
});

test('lightness-range and chroma-range catch out-of-range lab/lch values', () => {
  assert.deepEqual(findingsOf('bad-lightness-chroma.css'), [
    { line: 2, ruleId: 'lightness-range' },
    { line: 3, ruleId: 'lightness-range' },
    { line: 4, ruleId: 'lightness-range' },
    { line: 5, ruleId: 'chroma-range' },
    { line: 6, ruleId: 'chroma-range' },
    { line: 7, ruleId: 'chroma-range' },
  ]);
});

test('disable comments suppress only the rules they name', () => {
  assert.deepEqual(findingsOf('disable-comments.css'), [
    { line: 3, ruleId: 'channel-mix' },
    { line: 4, ruleId: 'hue-range' },
    { line: 7, ruleId: 'rgb-range' },
  ]);
});

test('var() and calc() channels are skipped but the rest of the function is still checked', () => {
  assert.deepEqual(findingsOf('var-calc.css'), [{ line: 3, ruleId: 'rgb-range' }]);
});

test('valid color values across every supported function produce no findings', () => {
  assert.deepEqual(findingsOf('clean.css'), []);
});
