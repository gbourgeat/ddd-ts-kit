import type { Config } from './config';

/**
 * The keys of ddd-ts-kit.config.json the parser reads at the root, the keys of `Config` but the
 * derived ones. It reads no other key, and `config/valid` names one it finds with the nearest key
 * of this list.
 */
export const KNOWN_CONFIG_KEYS = [
  'stack',
  'initVersion',
  'importAlias',
  'importExtension',
  'contexts',
  'rules',
  'sourceRoot',
  'contextsDir',
  'sharedKernelDir',
  'platformDir',
  'domainAllowedPackages',
  'applicationAllowedPackages',
  'publishedLanguageAllowedPackages',
  'limits',
  'onePerFile',
  'coverage',
  'budget',
  'mutation',
  'commit',
  'guard',
  'worktrees',
  'formatOnWrite',
  'dependenciesBeforeWrite',
  'deviations',
  'standardInterfaces',
  'businessNames',
  'privacy',
  'worker',
  'ci',
  'agents',
  'owners',
  'openapi',
  'sdk',
] as const satisfies readonly (keyof Config)[];
