import type { Config } from '../../config/index.js';
import type { InitFile } from './init-file.js';
import { when } from './when.js';

/** What sits at the root of the project: the containers, the environment, the test runner, the analyzers and the git hooks. */
export function projectFiles(config: Config, projectName: string): InitFile[] {
  const { http, authn, tests } = config.stack;

  return [
    ['.gitignore', 'init/gitignore.tpl'],
    ['.dockerignore', 'init/docker/dockerignore.tpl'],
    ['Dockerfile', 'init/docker/Dockerfile.tpl'],
    ['docker-compose.yml', 'init/docker/docker-compose.yml.tpl'],
    ['.env.example', 'init/docker/env.example.tpl'],
    // The realm a local Keycloak imports at its first start: the API client, its audience mapper, a client for the direct grant, demo users.
    ...when(http !== 'none' && authn === 'keycloak', [[`docker/keycloak/${projectName}-realm.json`, 'init/docker/keycloak-realm.json.tpl']]),
    ['README.md', 'init/README.md.tpl'],
    tests === 'jest' ? ['jest.config.js', 'init/jest.config.js.tpl'] : ['vitest.config.ts', 'pipeline/vitest.config.ts.tpl'],
    ['eslint.config.mjs', 'pipeline/eslint.config.mjs.tpl'],
    ['knip.json', 'pipeline/knip.json.tpl'],
    ['lefthook.yml', 'pipeline/lefthook.yml'],
    ['commitlint.config.mjs', 'pipeline/commitlint.config.mjs'],
  ];
}
