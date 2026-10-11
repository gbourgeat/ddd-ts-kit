import type { Config } from '../../config/index.js';
import type { InitFile } from './init-file.js';
import { when } from './when.js';

/** What sits at the root of the project: the containers, the environment, the test runner, the analyzers and the git hooks. */
export function projectFiles(config: Config, projectName: string): InitFile[] {
  const { http, authn, tests, packageManager } = config.stack;

  return [
    ['.gitignore', 'init/gitignore.tpl'],
    ['.dockerignore', 'init/docker/dockerignore.tpl'],
    ['Dockerfile', 'init/docker/Dockerfile.tpl'],
    ['docker-compose.yml', 'init/docker/docker-compose.yml.tpl'],
    ['.env.example', 'init/docker/env.example.tpl'],
    // The realm a local Keycloak imports at its first start: the API client, its audience mapper, a client for the direct grant, demo users.
    ...when(http !== 'none' && authn === 'keycloak', [
      [`docker/keycloak/${projectName}-realm.json`, 'init/docker/keycloak-realm.json.tpl'],
    ]),
    // pnpm stops at a dependency whose build script nobody decided on: the file says none runs unless allowed by name.
    ...when(packageManager === 'pnpm', [['pnpm-workspace.yaml', 'init/pnpm-workspace.yaml']]),
    ['README.md', 'init/README.md.tpl'],
    tests === 'jest'
      ? ['jest.config.js', 'init/jest.config.js.tpl']
      : ['vitest.config.ts', 'pipeline/vitest.config.ts.tpl'],
    ['eslint.config.mjs', 'pipeline/eslint.config.mjs.tpl'],
    ['biome.json', 'pipeline/biome.json.tpl'],
    ['knip.json', 'pipeline/knip.json.tpl'],
    ['lefthook.yml', 'pipeline/lefthook.yml'],
    ['commitlint.config.mjs', 'pipeline/commitlint.config.mjs'],
  ];
}
