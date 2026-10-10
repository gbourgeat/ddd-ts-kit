import type { Fixture } from './fixture.js';
import { project } from './project.js';
import { source } from './source.js';

const LOAD_CONFIG = 'src/platform/config/load-config.ts';
const APP_CONFIG = 'src/platform/config/app-config.ts';
const SUPPORT = 'test/e2e/support/start-application.ts';
const SCRIPT = 'scripts/openapi.ts';
const SETTINGS = 'export const appConfig = { port: 3000 };\n';

export const IMPORTS_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'imports/alias-only',
    name: 'alias imports under the source root, in a test and in a script; packages and built-ins are not project files',
    expect: 'pass',
    files: project({
      [APP_CONFIG]: SETTINGS,
      [LOAD_CONFIG]: loading(
        "import path from 'node:path';",
        "import { appConfig } from '#src/platform/config/app-config.js';",
        "export type { appConfig as Settings } from '#src/platform/config/app-config.js';",
        "export const later = (): Promise<unknown> => import('#src/platform/config/app-config.js');",
        'export const separator = path.sep;',
      ),
      [SUPPORT]:
        "import { loadConfig } from '#src/platform/config/load-config.js';\nexport const start = loadConfig;\n",
      'test/e2e/journey.e2e.spec.ts': "import { start } from '#test/e2e/support/start-application.js';\nstart();\n",
      [SCRIPT]: "import { loadConfig } from '#src/platform/config/load-config.js';\nloadConfig();\n",
    }),
  },
  {
    ruleId: 'imports/alias-only',
    name: 'a relative import of the same directory',
    expect: { file: LOAD_CONFIG },
    files: project({
      [APP_CONFIG]: SETTINGS,
      [LOAD_CONFIG]: loading("import { appConfig } from './app-config.js';"),
    }),
  },
  {
    ruleId: 'imports/alias-only',
    name: 'a relative import of a parent directory',
    expect: { file: 'src/platform/http/load-config.ts' },
    files: project({
      [APP_CONFIG]: SETTINGS,
      'src/platform/http/load-config.ts': loading("import { appConfig } from '../config/app-config.js';"),
    }),
  },
  {
    ruleId: 'imports/alias-only',
    name: 'a relative re-export',
    expect: { file: LOAD_CONFIG },
    files: project({ [APP_CONFIG]: SETTINGS, [LOAD_CONFIG]: "export { appConfig } from './app-config.js';\n" }),
  },
  {
    ruleId: 'imports/alias-only',
    name: 'a relative dynamic import',
    expect: { file: LOAD_CONFIG },
    files: project({
      [APP_CONFIG]: SETTINGS,
      [LOAD_CONFIG]: "export const later = (): Promise<unknown> => import('./app-config.js');\n",
    }),
  },
  {
    ruleId: 'imports/alias-only',
    name: 'a relative import between two test files',
    expect: { file: 'test/e2e/journey.e2e.spec.ts' },
    files: project({
      [SUPPORT]: 'export const start = 1;\n',
      'test/e2e/journey.e2e.spec.ts': "import { start } from './support/start-application.js';\nexport { start };\n",
    }),
  },
  {
    ruleId: 'imports/alias-only',
    name: 'a script reaching the sources by a relative path',
    expect: { file: SCRIPT },
    files: project({
      [APP_CONFIG]: SETTINGS,
      [SCRIPT]: "import { appConfig } from '../src/platform/config/app-config.js';\nexport { appConfig };\n",
    }),
  },
  {
    ruleId: 'imports/alias-only',
    name: 'a relative import of a file no alias names',
    expect: { file: LOAD_CONFIG },
    files: project({ [LOAD_CONFIG]: "export { default as manifest } from '../../../package.json';\n" }),
  },
  {
    ruleId: 'imports/alias-only',
    name: 'an alias path that leaves its directory by a ".." segment',
    expect: { file: LOAD_CONFIG },
    files: project({ [LOAD_CONFIG]: "export { default as manifest } from '#src/../package.js';\n" }),
  },
];

function loading(...imports: string[]): string {
  return source(...imports, 'export function loadConfig(): unknown {', '  return appConfig;', '}');
}
