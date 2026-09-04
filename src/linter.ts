import { lintLine, type Finding, type LintOptions } from './rules.js';

export interface FileResult {
  filePath: string;
  findings: Finding[];
}

// A bare `colorlint-disable-line` / `colorlint-disable-next-line` silences
// every rule; naming rule ids after it (comma-separated) narrows that down.
const DISABLE_LINE_PATTERN = /\/\*\s*colorlint-disable-line(?:\s+([\w,\s-]+?))?\s*\*\//;
const DISABLE_NEXT_LINE_PATTERN = /\/\*\s*colorlint-disable-next-line(?:\s+([\w,\s-]+?))?\s*\*\//;

type Disabled = Set<string> | 'all' | null;

function parseDisabledRules(match: RegExpMatchArray | null): Disabled {
  if (!match) return null;
  if (!match[1]) return 'all';
  return new Set(
    match[1]
      .split(',')
      .map((ruleId) => ruleId.trim())
      .filter((ruleId) => ruleId.length > 0),
  );
}

function mergeDisabled(a: Disabled, b: Disabled): Disabled {
  if (a === 'all' || b === 'all') return 'all';
  if (a === null) return b;
  if (b === null) return a;
  return new Set([...a, ...b]);
}

function isDisabled(ruleId: string, disabled: Disabled): boolean {
  if (disabled === null) return false;
  if (disabled === 'all') return true;
  return disabled.has(ruleId);
}

export function lintSource(filePath: string, source: string, options: LintOptions): FileResult {
  const lines = source.split(/\r\n|\r|\n/);
  const findings: Finding[] = [];
  let pendingNextLineDisable: Disabled = null;
  lines.forEach((line, index) => {
    const disabled = mergeDisabled(parseDisabledRules(line.match(DISABLE_LINE_PATTERN)), pendingNextLineDisable);
    pendingNextLineDisable = parseDisabledRules(line.match(DISABLE_NEXT_LINE_PATTERN));

    for (const finding of lintLine(line, index + 1, options)) {
      if (!isDisabled(finding.ruleId, disabled)) {
        findings.push(finding);
      }
    }
  });
  findings.sort((a, b) => a.line - b.line || a.column - b.column);
  return { filePath, findings };
}

export type { Finding, LintOptions } from './rules.js';
