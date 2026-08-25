export type Severity = 'error' | 'warning';

export interface Finding {
  line: number;
  column: number;
  ruleId: string;
  message: string;
  severity: Severity;
}

export interface LintOptions {
  lenient: boolean;
}

const HEX_PATTERN = /#([0-9a-fA-F]+)\b/g;
const FUNCTION_PATTERN = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(([^()]*)\)/g;
const VALID_HEX_LENGTHS = [3, 4, 6, 8];

// lch/oklch put hue third (L C H); hsl/hsla/hwb put it first.
const HUE_CHANNEL_INDEX: Record<string, number> = {
  hsl: 0,
  hsla: 0,
  hwb: 0,
  lch: 2,
  oklch: 2,
};

// Rules flagged here are real syntax errors: hex-length always stays an
// error regardless of --lenient. Range and consistency rules are the ones
// --lenient is meant to soften, since older codebases mix styles on purpose.
function severityFor(downgradable: boolean, lenient: boolean): Severity {
  return lenient && downgradable ? 'warning' : 'error';
}

export function lintLine(text: string, lineNumber: number, options: LintOptions): Finding[] {
  return [...checkHexColors(text, lineNumber), ...checkColorFunctions(text, lineNumber, options)];
}

function checkHexColors(text: string, lineNumber: number): Finding[] {
  const findings: Finding[] = [];
  HEX_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HEX_PATTERN.exec(text)) !== null) {
    const digits = match[1];
    if (!VALID_HEX_LENGTHS.includes(digits.length)) {
      findings.push({
        line: lineNumber,
        column: match.index + 1,
        ruleId: 'hex-length',
        message: `hex color "#${digits}" has ${digits.length} digit(s); expected 3, 4, 6, or 8`,
        severity: 'error',
      });
    }
  }
  return findings;
}

function checkColorFunctions(text: string, lineNumber: number, options: LintOptions): Finding[] {
  const findings: Finding[] = [];
  FUNCTION_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FUNCTION_PATTERN.exec(text)) !== null) {
    const fnName = match[1].toLowerCase();
    const column = match.index + 1;
    const channels = extractColorChannels(match[2]);
    if (channels.length === 0) continue;

    if (fnName === 'rgb' || fnName === 'rgba') {
      checkRgbChannels(fnName, channels, lineNumber, column, options, findings);
    }

    const hueIndex = HUE_CHANNEL_INDEX[fnName];
    if (hueIndex !== undefined && hueIndex < channels.length) {
      checkHueChannel(fnName, channels[hueIndex], lineNumber, column, options, findings);
    }
  }
  return findings;
}

function checkRgbChannels(
  fnName: string,
  channels: string[],
  line: number,
  column: number,
  options: LintOptions,
  findings: Finding[],
): void {
  const kinds = new Set(channels.map(classifyNumber));
  if (kinds.has('number') && kinds.has('percentage')) {
    findings.push({
      line,
      column,
      ruleId: 'channel-mix',
      message: `${fnName}() mixes bare numbers and percentages across channels; use one form consistently`,
      severity: severityFor(true, options.lenient),
    });
  }

  for (const channel of channels) {
    const kind = classifyNumber(channel);
    const value = Number.parseFloat(channel);
    if (kind === 'number' && (value < 0 || value > 255)) {
      findings.push({
        line,
        column,
        ruleId: 'rgb-range',
        message: `${fnName}() channel "${channel}" is outside the 0-255 range`,
        severity: severityFor(true, options.lenient),
      });
    } else if (kind === 'percentage' && (value < 0 || value > 100)) {
      findings.push({
        line,
        column,
        ruleId: 'rgb-range',
        message: `${fnName}() channel "${channel}" is outside the 0%-100% range`,
        severity: severityFor(true, options.lenient),
      });
    }
  }
}

function checkHueChannel(
  fnName: string,
  hueRaw: string,
  line: number,
  column: number,
  options: LintOptions,
  findings: Finding[],
): void {
  const hueValue = Number.parseFloat(hueRaw);
  if (!Number.isNaN(hueValue) && (hueValue < 0 || hueValue > 360)) {
    findings.push({
      line,
      column,
      ruleId: 'hue-range',
      message: `${fnName}() hue "${hueRaw}" is outside 0-360; wrap it explicitly if that is intended`,
      severity: severityFor(true, options.lenient),
    });
  }
}

type ChannelKind = 'number' | 'percentage' | 'other';

function classifyNumber(token: string): ChannelKind {
  if (/^-?\d+(\.\d+)?%$/.test(token)) return 'percentage';
  if (/^-?\d+(\.\d+)?$/.test(token)) return 'number';
  return 'other';
}

// Legacy comma syntax puts alpha as a trailing comma-separated value
// (rgba(r, g, b, a)); modern space syntax uses a slash (rgb(r g b / a)).
// Either way we strip alpha out before range-checking the color channels.
function extractColorChannels(argsRaw: string): string[] {
  const slashIndex = argsRaw.indexOf('/');
  const beforeSlash = slashIndex === -1 ? argsRaw : argsRaw.slice(0, slashIndex);
  const isCommaSeparated = beforeSlash.includes(',');
  const separator = isCommaSeparated ? ',' : /\s+/;
  const parts = beforeSlash
    .split(separator)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (slashIndex === -1 && isCommaSeparated && parts.length === 4) {
    return parts.slice(0, 3);
  }
  return parts;
}
