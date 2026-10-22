import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { Fixture } from './fixture';
import { project } from './project';

const RULE = 'imports/extension';
const LOAD_CONFIG = 'src/platform/config/load-config.ts';
const APP_CONFIG = 'src/platform/config/app-config.ts';
const SUPPORT = 'test/e2e/support/start-application.ts';
const JOURNEY = 'test/e2e/journey.e2e.spec.ts';
const SCRIPT = 'scripts/openapi.ts';
const INDEX = 'src/platform/config/index.ts';
const SETTINGS = 'export const appConfig = { port: 3000 };\n';
const NONE = { [CONFIG_FILE]: config({ importExtension: 'none' }) };
const JS = { [CONFIG_FILE]: config({ importExtension: 'js' }) };

export const EXTENSION_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'no extension under "none": a static import, a re-export, a dynamic import, a test and a script; a package subpath that ends like a file is not a project file',
    expect: 'pass',
    files: project(
      {
        [APP_CONFIG]: SETTINGS,
        [INDEX]: "export { appConfig } from '@/platform/config/app-config';\n",
        [LOAD_CONFIG]: [
          "import { core } from 'zod/v4/core.js';",
          "import { appConfig } from '@/platform/config/app-config';",
          "export type { appConfig as Settings } from '@/platform/config';",
          "export const later = (): Promise<unknown> => import('@/platform/config/app-config');",
          'export const loaded = [core, appConfig];\n',
        ].join('\n'),
        [SUPPORT]: "import { loaded } from '@/platform/config/load-config';\nexport const start = loaded;\n",
        [JOURNEY]: "import { start } from '$test/e2e/support/start-application';\nexport { start };\n",
        [SCRIPT]: "import { loaded } from '@/platform/config/load-config';\nexport { loaded };\n",
      },
      NONE,
    ),
  },
  {
    ruleId: RULE,
    name: '".js" under "js", and in a project whose config does not say: it was written before the key existed',
    expect: 'pass',
    files: project({
      [APP_CONFIG]: SETTINGS,
      [LOAD_CONFIG]: "export { appConfig } from '@/platform/config/app-config.js';\n",
      [JOURNEY]: "export { appConfig } from '@/platform/config/app-config.js';\n",
    }),
  },
  failing('".js" under "none"', NONE, [LOAD_CONFIG, "export { appConfig } from '@/platform/config/app-config.js';\n"]),
  failing('".ts" under "none"', NONE, [LOAD_CONFIG, "export { appConfig } from '@/platform/config/app-config.ts';\n"]),
  failing('".mjs" in a dynamic import under "none"', NONE, [
    LOAD_CONFIG,
    "export const later = (): Promise<unknown> => import('@/platform/config/app-config.mjs');\n",
  ]),
  failing('".js" in a test under "none"', NONE, [JOURNEY, "export { start } from '$test/e2e/support/start.js';\n"]),
  failing('".js" in a script under "none"', NONE, [
    SCRIPT,
    "export { appConfig } from '@/platform/config/app-config.js';\n",
  ]),
  {
    ruleId: RULE,
    name: 'a directory under "none": the compiler completes it with its index and so does the build',
    expect: 'pass',
    files: project(
      {
        [APP_CONFIG]: SETTINGS,
        [INDEX]: "export { appConfig } from '@/platform/config/app-config';\n",
        [LOAD_CONFIG]: "export { appConfig } from '@/platform/config';\n",
      },
      NONE,
    ),
  },
  failing('no extension under "js"', JS, [LOAD_CONFIG, "export { appConfig } from '@/platform/config/app-config';\n"]),
  failing('".ts" under "js"', JS, [LOAD_CONFIG, "export { appConfig } from '@/platform/config/app-config.ts';\n"]),
  failing('no extension in a project whose config does not say', {}, [
    JOURNEY,
    "export { appConfig } from '@/platform/config/app-config';\n",
  ]),
];

/** One file that writes an import the config does not allow, in a project whose config is `overrides`. */
function failing(name: string, overrides: Fixture['files'], [file, content]: readonly [string, string]): Fixture {
  const files = project({ [APP_CONFIG]: SETTINGS, [file]: content }, overrides);

  return { ruleId: RULE, name, expect: { file }, files };
}
