import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { lintSource } from './linter.js';
import { loadConfig } from './config.js';

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

test('loadConfig reads disabled rules from an explicit config path', () => {
  const config = loadConfig(path.join(fixturesDir, 'config', 'valid.json'), fixturesDir);
  assert.deepEqual([...config.disabledRules], ['hex-length']);
});

test('loadConfig finds .colorlintrc.json in cwd when no path is given', () => {
  const config = loadConfig(undefined, path.join(fixturesDir, 'config', 'default-lookup'));
  assert.deepEqual([...config.disabledRules], ['hex-length']);
});

test('loadConfig returns no disabled rules when there is nothing to find', () => {
  const config = loadConfig(undefined, fixturesDir);
  assert.deepEqual([...config.disabledRules], []);
});

test('loadConfig rejects unknown rule ids', () => {
  assert.throws(
    () => loadConfig(path.join(fixturesDir, 'config', 'unknown-rule.json'), fixturesDir),
    /unknown rule id "not-a-real-rule"/,
  );
});

test('loadConfig rejects non-boolean rule values', () => {
  assert.throws(
    () => loadConfig(path.join(fixturesDir, 'config', 'bad-value.json'), fixturesDir),
    /must be true or false/,
  );
});

test('loadConfig rejects a missing explicit config path', () => {
  assert.throws(() => loadConfig(path.join(fixturesDir, 'config', 'nope.json'), fixturesDir), /config file not found/);
});

test('a rule disabled via config produces no findings even where it would otherwise fire', () => {
  const config = loadConfig(path.join(fixturesDir, 'config', 'valid.json'), fixturesDir);
  const source = readFileSync(path.join(fixturesDir, 'bad-hex.css'), 'utf8');
  const findings = lintSource('bad-hex.css', source, {
    lenient: false,
    disabledRules: config.disabledRules,
  }).findings;
  assert.deepEqual(findings, []);
});
