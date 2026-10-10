import { CliError } from '../cli-error.js';
import type { Config, Deviation } from './config.js';
import { CONFIG_FILE } from './config-file.js';
import { defaultAllowedPackages } from './default-allowed-packages.js';
import { parseCommitLimits } from './parse-commit-limits.js';
import { parseContext } from './parse-context.js';
import { parseLimits } from './parse-limits.js';
import { parseOnePerFile } from './parse-one-per-file.js';
import { parseStack } from './parse-stack.js';
import { isRecord } from './values/is-record.js';
import { mapEntries } from './values/map-entries.js';
import { posix } from './values/posix.js';
import { strings } from './values/strings.js';
import { text } from './values/text.js';

/**
 * Tolerant on purpose: a wrong classification or an unknown upstream is reported by
 * `check` as `config/valid`, with a line number, instead of stopping every command.
 */
export function parseConfig(raw: unknown): Config {
  if (!isRecord(raw)) throw new CliError(`${CONFIG_FILE} must hold a JSON object.`, 'Recreate it with `ddd-ts-kit init`.');

  const sourceRoot = posix(text(raw['sourceRoot'], 'src'));
  const stack = parseStack(isRecord(raw['stack']) ? raw['stack'] : {});

  return {
    sourceRoot,
    contextsDir: posix(text(raw['contextsDir'], `${sourceRoot}/contexts`)),
    sharedKernelDir: posix(text(raw['sharedKernelDir'], `${sourceRoot}/shared-kernel`)),
    platformDir: posix(text(raw['platformDir'], `${sourceRoot}/platform`)),
    importAlias: text(raw['importAlias'], '@/'),
    stack,
    contexts: mapEntries(raw['contexts'], parseContext),
    rules: mapEntries(raw['rules'], String),
    ...parseAllowedPackages(raw, stack.validation),
    ...parseGovernance(raw),
  };
}

type AllowedPackages = Pick<Config, 'domainAllowedPackages' | 'applicationAllowedPackages' | 'publishedLanguageAllowedPackages'>;

function parseAllowedPackages(raw: Record<string, unknown>, validation: string): AllowedPackages {
  const defaults = defaultAllowedPackages(validation);

  return {
    domainAllowedPackages: strings(raw['domainAllowedPackages'], defaults.domainAllowedPackages),
    applicationAllowedPackages: strings(raw['applicationAllowedPackages'], defaults.applicationAllowedPackages),
    publishedLanguageAllowedPackages: strings(raw['publishedLanguageAllowedPackages'], defaults.publishedLanguageAllowedPackages),
  };
}

type Governance = Pick<Config, 'limits' | 'onePerFile' | 'commit' | 'guard' | 'deviations' | 'standardInterfaces' | 'worker'>;

function parseGovernance(raw: Record<string, unknown>): Governance {
  return {
    limits: parseLimits(raw['limits']),
    onePerFile: parseOnePerFile(raw['onePerFile']),
    commit: parseCommitLimits(raw['commit']),
    guard: text(raw['guard'], 'enforce'),
    deviations: parseDeviations(raw['deviations']),
    standardInterfaces: parseStandardInterfaces(raw['standardInterfaces']),
    worker: raw['worker'] === true,
  };
}

function parseDeviations(value: unknown): Deviation[] {
  const entries: unknown[] = Array.isArray(value) ? value : [];

  return entries.filter(isRecord).map((entry) => ({ what: text(entry['what'], ''), adr: text(entry['adr'], ''), reason: text(entry['reason'], '') }));
}

function parseStandardInterfaces(value: unknown): Record<string, string | false> {
  const entries = Object.entries(isRecord(value) ? value : {}).flatMap(([name, instead]): [string, string | false][] => (instead === false || (typeof instead === 'string' && instead !== '') ? [[name, instead]] : []));

  return Object.fromEntries(entries);
}
