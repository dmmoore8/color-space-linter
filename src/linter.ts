import { lintLine, type Finding, type LintOptions } from './rules.js';

export interface FileResult {
  filePath: string;
  findings: Finding[];
}

export function lintSource(filePath: string, source: string, options: LintOptions): FileResult {
  const lines = source.split(/\r\n|\r|\n/);
  const findings: Finding[] = [];
  lines.forEach((line, index) => {
    findings.push(...lintLine(line, index + 1, options));
  });
  findings.sort((a, b) => a.line - b.line || a.column - b.column);
  return { filePath, findings };
}

export type { Finding, LintOptions } from './rules.js';
