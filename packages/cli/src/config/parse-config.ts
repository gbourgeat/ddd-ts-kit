import { CliError } from '../cli-error';
import type { AgentsConfig, Config, Deviation, OwnersConfig } from './config';
import { CONFIG_FILE } from './config-file';
import { defaultAllowedPackages } from './default-allowed-packages';
import { DEFAULT_IMPORT_ALIAS } from './default-import-alias';
import { parseBusinessNames } from './parse-business-names';
import { parsePrivacy } from './parse-privacy';
import { parseCi } from './parse-ci';
import { parseCommitConfig } from './parse-commit-config';
import { parseContext } from './parse-context';
import { parseBudget } from './parse-budget';
import { parseCoverage } from './parse-coverage';
import { parseMutation } from './parse-mutation';
import { parseLimits } from './parse-limits';
import { parseOnePerFile } from './parse-one-per-file';
import { parseOpenApi } from './parse-open-api';
import { parseRuleSetting } from './parse-rule-setting';
import { parseSdk } from './parse-sdk';
import { parseStack } from './parse-stack';
import { directoriesOf } from './directories-of';
import { insideDefaultsOf } from './inside-defaults-of';
import { leavesProject } from './leaves-project';
import { leavingDirectoryProblem } from './leaving-directory-problem';
import { normalizedDirectory } from './normalized-directory';
import { PROJECT_DIRECTORIES, type ProjectDirectory } from './project-directories';
import { isRecord } from './values/is-record';
import { mapEntries } from './values/map-entries';
import { strings } from './values/strings';
import { text } from './values/text';
import { UNWRITTEN_IMPORT_EXTENSION } from './unwritten-import-extension';

/** What a command does with a directory of the config that leads out of the project. */
export interface ParseOptions {
  /** `refuse` (every command that writes) stops the command; `default` (check) reads the default and lets `config/valid` report it. */
  readonly leaving: 'refuse' | 'default';
}

/**
 * Tolerant on purpose: a wrong classification or an unknown upstream is reported by
 * `check` as `config/valid`, with a line number, instead of stopping every command. A directory
 * that leads out of the project is not: the generators would write there.
 */
export function parseConfig(raw: unknown, options: ParseOptions = { leaving: 'refuse' }): Config {
  if (!isRecord(raw)) {
    throw new CliError(`${CONFIG_FILE} must hold a JSON object.`, 'Recreate it with `ddd-ts-kit init`.');
  }

  const directories = confinedDirectories(raw, options);
  const stack = parseStack(isRecord(raw['stack']) ? raw['stack'] : {});
  const initVersion = raw['initVersion'];

  return {
    initVersion: typeof initVersion === 'string' ? initVersion : undefined,
    ...directories,
    importAlias: text(raw['importAlias'], DEFAULT_IMPORT_ALIAS),
    importExtension: text(raw['importExtension'], UNWRITTEN_IMPORT_EXTENSION),
    stack,
    contexts: mapEntries(raw['contexts'], parseContext),
    rules: mapEntries(raw['rules'], parseRuleSetting),
    ...parseAllowedPackages(raw, stack.validation),
    ...parseGovernance(raw),
  };
}

/** The directories of the config, normalised; one that leads out of the project refused, or read as its default. */
function confinedDirectories(
  raw: Record<string, unknown>,
  { leaving }: ParseOptions,
): Record<ProjectDirectory, string> {
  const written = directoriesOf(raw);
  const defaults = insideDefaultsOf(raw);
  const out = PROJECT_DIRECTORIES.filter((key) => leavesProject(written[key]));
  const [first] = out;

  if (first !== undefined && leaving === 'refuse') {
    const { message, fix } = leavingDirectoryProblem(first, written[first], normalizedDirectory(defaults[first]));

    throw new CliError(`${CONFIG_FILE}: ${message}`, `${fix} \`ddd-ts-kit check --rule config/valid\` reports it too.`);
  }

  const confined = (key: ProjectDirectory): string =>
    normalizedDirectory((out.includes(key) ? defaults : written)[key]);

  return {
    sourceRoot: confined('sourceRoot'),
    contextsDir: confined('contextsDir'),
    sharedKernelDir: confined('sharedKernelDir'),
    platformDir: confined('platformDir'),
  };
}

type AllowedPackages = Pick<
  Config,
  'domainAllowedPackages' | 'applicationAllowedPackages' | 'publishedLanguageAllowedPackages'
>;

function parseAllowedPackages(raw: Record<string, unknown>, validation: string): AllowedPackages {
  const defaults = defaultAllowedPackages(validation);

  return {
    domainAllowedPackages: strings(raw['domainAllowedPackages'], defaults.domainAllowedPackages),
    applicationAllowedPackages: strings(raw['applicationAllowedPackages'], defaults.applicationAllowedPackages),
    publishedLanguageAllowedPackages: strings(
      raw['publishedLanguageAllowedPackages'],
      defaults.publishedLanguageAllowedPackages,
    ),
  };
}

type Governance = Pick<
  Config,
  | 'limits'
  | 'onePerFile'
  | 'coverage'
  | 'budget'
  | 'mutation'
  | 'commit'
  | 'guard'
  | 'worktrees'
  | 'formatOnWrite'
  | 'dependenciesBeforeWrite'
  | 'deviations'
  | 'standardInterfaces'
  | 'businessNames'
  | 'privacy'
  | 'worker'
  | 'ci'
  | 'agents'
  | 'owners'
  | 'openapi'
  | 'sdk'
>;

function parseGovernance(raw: Record<string, unknown>): Governance {
  return {
    limits: parseLimits(raw['limits']),
    onePerFile: parseOnePerFile(raw['onePerFile']),
    coverage: parseCoverage(raw['coverage']),
    budget: parseBudget(raw['budget']),
    mutation: parseMutation(raw['mutation']),
    commit: parseCommitConfig(raw['commit']),
    guard: text(raw['guard'], 'enforce'),
    worktrees: text(raw['worktrees'], 'advised'),
    formatOnWrite: raw['formatOnWrite'] === true,
    dependenciesBeforeWrite: raw['dependenciesBeforeWrite'] === true,
    deviations: parseDeviations(raw['deviations']),
    standardInterfaces: parseStandardInterfaces(raw['standardInterfaces']),
    businessNames: parseBusinessNames(raw['businessNames']),
    privacy: parsePrivacy(raw['privacy']),
    worker: raw['worker'] === true,
    ci: parseCi(raw['ci']),
    agents: parseAgents(raw['agents']),
    owners: parseOwners(raw['owners']),
    openapi: parseOpenApi(raw['openapi']),
    sdk: parseSdk(raw['sdk']),
  };
}

/** Tolerant: an unknown profile is kept as written, and `config/valid` reports it. */
function parseAgents(value: unknown): AgentsConfig {
  const profile = isRecord(value) ? value['profile'] : undefined;

  return { profile: typeof profile === 'string' && profile !== '' ? profile : undefined };
}

/** Tolerant: a handle is kept as written, for the platform of the repository to judge. */
function parseOwners(value: unknown): OwnersConfig {
  return { platform: isRecord(value) ? strings(value['platform'], []) : [] };
}

function parseDeviations(value: unknown): Deviation[] {
  const entries: unknown[] = Array.isArray(value) ? value : [];

  return entries.filter(isRecord).map((entry) => ({
    what: text(entry['what'], ''),
    adr: text(entry['adr'], ''),
    reason: text(entry['reason'], ''),
  }));
}

function parseStandardInterfaces(value: unknown): Record<string, string | false> {
  const entries = Object.entries(isRecord(value) ? value : {}).flatMap(([name, instead]): [string, string | false][] =>
    instead === false || (typeof instead === 'string' && instead !== '') ? [[name, instead]] : [],
  );

  return Object.fromEntries(entries);
}
