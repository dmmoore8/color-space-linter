import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { RULE_IDS, type RuleId } from './rules.js';

export interface Config {
  disabledRules: Set<RuleId>;
}

const DEFAULT_CONFIG_NAME = '.colorlintrc.json';

function isRuleId(value: string): value is RuleId {
  return (RULE_IDS as readonly string[]).includes(value);
}

function parseConfig(raw: string, sourcePath: string): Config {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`could not parse ${sourcePath} as JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${sourcePath}: config must be a JSON object`);
  }

  const rules = (parsed as Record<string, unknown>).rules;
  const disabledRules = new Set<RuleId>();
  if (rules !== undefined) {
    if (typeof rules !== 'object' || rules === null || Array.isArray(rules)) {
      throw new Error(`${sourcePath}: "rules" must be an object`);
    }
    for (const [ruleId, value] of Object.entries(rules as Record<string, unknown>)) {
      if (!isRuleId(ruleId)) {
        throw new Error(`${sourcePath}: unknown rule id "${ruleId}" (expected one of ${RULE_IDS.join(', ')})`);
      }
      if (typeof value !== 'boolean') {
        throw new Error(`${sourcePath}: rule "${ruleId}" must be true or false, got ${JSON.stringify(value)}`);
      }
      if (!value) disabledRules.add(ruleId);
    }
  }

  return { disabledRules };
}

// With an explicit path, a missing or malformed file is an error. Without
// one, we only look for the default file name in cwd, and its absence just
// means "no config" rather than a failure.
export function loadConfig(configPath: string | undefined, cwd: string): Config {
  if (configPath) {
    const resolved = path.resolve(cwd, configPath);
    if (!existsSync(resolved)) {
      throw new Error(`config file not found: ${configPath}`);
    }
    return parseConfig(readFileSync(resolved, 'utf8'), resolved);
  }

  const defaultPath = path.join(cwd, DEFAULT_CONFIG_NAME);
  if (existsSync(defaultPath)) {
    return parseConfig(readFileSync(defaultPath, 'utf8'), defaultPath);
  }

  return { disabledRules: new Set() };
}
