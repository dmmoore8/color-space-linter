#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { lintSource, type FileResult, type Finding } from './linter.js';

interface ParsedArgs {
  files: string[];
  lenient: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const files: string[] = [];
  let lenient = false;
  for (const arg of argv) {
    if (arg === '--lenient') {
      lenient = true;
    } else if (arg.startsWith('--')) {
      throw new Error(`unknown flag: ${arg}`);
    } else {
      files.push(arg);
    }
  }
  return { files, lenient };
}

function formatFinding(finding: Finding): string {
  const label = finding.severity === 'error' ? 'error' : 'warn ';
  return `  ${finding.line}:${finding.column}  ${label}  ${finding.message}  (${finding.ruleId})`;
}

function main(): void {
  const argv = process.argv.slice(2);
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 2;
    return;
  }

  if (parsed.files.length === 0) {
    console.error('usage: colorlint [--lenient] <file...>');
    process.exitCode = 2;
    return;
  }

  const results: FileResult[] = [];
  for (const filePath of parsed.files) {
    let source: string;
    try {
      source = readFileSync(filePath, 'utf8');
    } catch {
      console.error(`could not read ${filePath}`);
      process.exitCode = 2;
      continue;
    }
    results.push(lintSource(filePath, source, { lenient: parsed.lenient }));
  }

  let errorCount = 0;
  let warningCount = 0;
  for (const result of results) {
    if (result.findings.length === 0) continue;
    console.log(result.filePath);
    for (const finding of result.findings) {
      console.log(formatFinding(finding));
      if (finding.severity === 'error') errorCount += 1;
      else warningCount += 1;
    }
  }

  const total = errorCount + warningCount;
  if (total > 0) {
    const mode = parsed.lenient ? ' (lenient mode)' : '';
    console.log(`\n${errorCount} error(s), ${warningCount} warning(s)${mode}`);
  }

  if (errorCount > 0) {
    process.exitCode = 1;
  }
}

main();
