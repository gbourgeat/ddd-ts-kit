import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { Fixture } from './fixture';
import type { FixtureFiles } from './fixture-files';
import { project } from './project';
import { source } from './source';

const LOAD_CONFIG = 'src/platform/config/load-config.ts';
const APP_CONFIG = 'src/platform/config/app-config.ts';
const SUPPORT = 'test/e2e/support/start-application.ts';
const SCRIPT = 'scripts/openapi.ts';
const SETTINGS = 'export const appConfig = { port: 3000 };\n';
const SETUP = 'test/support/test-database-setup.ts';

export const IMPORTS_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'imports/alias-only',
    name: 'alias imports under the source root, in a test and in a script; packages and built-ins are not project files',
    expect: 'pass',
    files: project({
      [APP_CONFIG]: SETTINGS,
      [LOAD_CONFIG]: loading(
        "import path from 'node:path';",
        "import { appConfig } from '@/platform/config/app-config.js';",
        "export type { appConfig as Settings } from '@/platform/config/app-config.js';",
        "export const later = (): Promise<unknown> => import('@/platform/config/app-config.js');",
        'export const separator = path.sep;',
      ),
      [SUPPORT]: "import { loadConfig } from '@/platform/config/load-config.js';\nexport const start = loadConfig;\n",
      'test/e2e/journey.e2e.spec.ts': "import { start } from '$test/e2e/support/start-application.js';\nstart();\n",
      [SCRIPT]: "import { loadConfig } from '@/platform/config/load-config.js';\nloadConfig();\n",
    }),
  },
  {
    ruleId: 'imports/alias-only',
    name: 'the files a test runner loads as its global setup, which name their neighbour of test/support by the ".ts" of its source',
    expect: 'pass',
    files: project({
      'test/support/test-database-run.ts': 'export const run = 1;\n',
      'test/support/test-database-setup.ts':
        "import { run } from './test-database-run.ts';\nexport const setup = run;\n",
    }),
  },
  {
    ruleId: 'imports/alias-only',
    name: 'without an extension, a neighbour of test/support named as every import is, and a file that has a directory of its name',
    expect: 'pass',
    files: project({
      [CONFIG_FILE]: config({ importExtension: 'none' }),
      'test/support/test-database-run.ts': 'export const run = 1;\n',
      'test/support/test-database-run/part.ts': 'export const part = 1;\n',
      'test/support/test-database-setup.ts': "import { run } from './test-database-run';\nexport const setup = run;\n",
    }),
  },
  setupFailing(
    'a neighbour of test/support named by the ".js" the compiler would emit, which a test runner cannot find',
    {
      [SETUP]: "import { run } from './test-database-run.js';\nexport const setup = run;\n",
    },
  ),
  {
    ruleId: 'imports/alias-only',
    name: 'neighbours of test/support that are no ".ts" source, named as the file is: a JSON file, a JavaScript file, an ".mts" source',
    expect: 'pass',
    files: project({
      'test/support/data.json': '{}\n',
      'test/support/helper.js': 'export const help = 1;\n',
      'test/support/esm.mts': 'export const esm = 1;\n',
      [SETUP]:
        "import data from './data.json' with { type: 'json' };\nimport { help } from './helper.js';\nimport { esm } from './esm.mts';\nexport const setup = [data, help, esm];\n",
    }),
  },
  {
    ruleId: 'imports/alias-only',
    name: 'without an extension, neighbours of test/support that are no ".ts" source, named as the file is',
    expect: 'pass',
    files: project({
      [CONFIG_FILE]: config({ importExtension: 'none' }),
      'test/support/data.json': '{}\n',
      'test/support/helper.js': 'export const help = 1;\n',
      'test/support/esm.mts': 'export const esm = 1;\n',
      [SETUP]:
        "import data from './data.json' with { type: 'json' };\nimport { help } from './helper.js';\nimport { esm } from './esm.mts';\nexport const setup = [data, help, esm];\n",
    }),
  },
  setupFailing('an ".mts" neighbour of test/support named by the ".mjs" the compiler would emit', {
    'test/support/esm.mts': 'export const esm = 1;\n',
    [SETUP]: "import { esm } from './esm.mjs';\nexport const setup = esm;\n",
  }),
  setupFailing('under ".js", a directory of test/support named as a neighbour', {
    'test/support/parts/index.ts': 'export const run = 1;\n',
    [SETUP]: "import { run } from './parts';\nexport const setup = run;\n",
  }),
  setupFailing('a neighbour of test/support named without the ".ts" of its source', {
    [SETUP]: "import { run } from './test-database-run';\nexport const setup = run;\n",
  }),
  setupFailing('without an extension, a neighbour of test/support named with one', {
    [CONFIG_FILE]: config({ importExtension: 'none' }),
    [SETUP]: "import { run } from './test-database-run.ts';\nexport const setup = run;\n",
  }),
  setupFailing('a directory of test/support named as a neighbour: its index is no file of test/support', {
    [CONFIG_FILE]: config({ importExtension: 'none' }),
    'test/support/parts/index.ts': 'export const run = 1;\n',
    [SETUP]: "import { run } from './parts';\nexport const setup = run;\n",
  }),
  setupFailing('the parent of test/support named as a neighbour', {
    [CONFIG_FILE]: config({ importExtension: 'none' }),
    'test/index.ts': 'export const run = 1;\n',
    [SETUP]: "import { run } from './..';\nexport const setup = run;\n",
  }),
  setupFailing('test/support itself named as a neighbour', {
    [CONFIG_FILE]: config({ importExtension: 'none' }),
    'test/support/index.ts': 'export const run = 1;\n',
    [SETUP]: "import { run } from './.';\nexport const setup = run;\n",
  }),
  {
    ruleId: 'imports/alias-only',
    name: 'a file of test/support that leaves its directory by a relative path',
    expect: { file: 'test/support/test-database-setup.ts' },
    files: project({
      [SUPPORT]: 'export const start = 1;\n',
      'test/support/test-database-setup.ts':
        "import { start } from '../e2e/support/start-application.js';\nexport const setup = start;\n",
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
    files: project({ [LOAD_CONFIG]: "export { default as manifest } from '@/../package.js';\n" }),
  },
];

/** A failing fixture of the global setup of a test runner, beside the neighbour it may name. */
function setupFailing(name: string, files: FixtureFiles): Fixture {
  return {
    ruleId: 'imports/alias-only',
    name,
    expect: { file: SETUP },
    files: project({ 'test/support/test-database-run.ts': 'export const run = 1;\n', ...files }),
  };
}

function loading(...imports: string[]): string {
  return source(...imports, 'export function loadConfig(): unknown {', '  return appConfig;', '}');
}
