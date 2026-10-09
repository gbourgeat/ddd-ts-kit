import type { Config } from '../config.js';

/**
 * One file `init` writes: its path in the project and its template under `templates/`. A
 * template ending in `.tpl` is rendered; any other is copied as it is (CI definitions hold
 * `${{ ... }}` expressions of their own).
 */
export type InitFile = readonly [target: string, template: string];

export function initFiles(config: Config): InitFile[] {
  return [
    ...projectFiles(config),
    ...platformFiles(config),
    ...authFiles(config),
    ...persistenceFiles(config),
    ...scriptFiles(config),
    ...endToEndFiles(config),
    ...qualityFiles(),
    ...pipelineFiles(config),
    ...guidanceFiles(),
  ];
}

function projectFiles(config: Config): InitFile[] {
  return [
    ['.gitignore', 'init/gitignore.tpl'],
    ['.dockerignore', 'init/docker/dockerignore.tpl'],
    ['Dockerfile', 'init/docker/Dockerfile.tpl'],
    ['docker-compose.yml', 'init/docker/docker-compose.yml.tpl'],
    ['.env.example', 'init/docker/env.example.tpl'],
    ['README.md', 'init/README.md.tpl'],
    config.stack.tests === 'jest' ? ['jest.config.js', 'init/jest.config.js.tpl'] : ['vitest.config.ts', 'pipeline/vitest.config.ts.tpl'],
  ];
}

function platformFiles(config: Config): InitFile[] {
  const { http, di, events, docsUi, broker } = config.stack;
  const platform = config.platformDir;
  const family = di === 'tsyringe' ? 'tsyringe' : 'manual';
  return [
    [`${config.sourceRoot}/main.ts`, 'init/main.ts.tpl'],
    [`${platform}/tracing.ts`, 'init/platform/tracing.ts.tpl'],
    [`${platform}/config.ts`, 'init/platform/config.ts.tpl'],
    [`${platform}/platform.module.ts`, `init/platform/platform.module.${family}.ts.tpl`],
    [`${platform}/application.ts`, `init/platform/application.${family}.ts.tpl`],
    [`${platform}/events.ts`, `init/platform/events.${broker}.ts.tpl`],
    ...when(broker === 'custom', [
      [`${platform}/custom-event-bus.ts`, 'init/platform/custom-event-bus.ts.tpl'],
      [`${platform}/custom-event-bus.contract.spec.ts`, 'init/platform/custom-event-bus.contract.spec.ts.tpl'],
    ]),
    ...when(events === 'outbox', [[`${platform}/outbox-relay.ts`, 'init/platform/outbox-relay.ts.tpl']]),
    ...when(http !== 'none', [[`${platform}/http-server.ts`, `init/platform/http-server.${http}.ts.tpl`]]),
    ...when(docsUi !== 'none', [[`${platform}/http-docs.ts`, 'init/platform/http-docs.ts.tpl']]),
  ];
}

function when(condition: boolean, files: readonly InitFile[]): readonly InitFile[] {
  return condition ? files : [];
}

/** What each authorization model needs next to its adapter of the `Authorizer` port. */
const AUTHORIZATION_MODEL: Readonly<Record<string, readonly string[]>> = {
  rbac: ['roles.ts'],
  abac: ['attribute-policies.ts'],
  rebac: ['relationships.ts', 'relationships.contract.spec.ts', 'permissions.ts'],
  custom: ['custom-authorizer.ts', 'custom-authorizer.contract.spec.ts', 'permissions.ts'],
};

/** Who is calling (at the HTTP boundary only) and what they may do (behind one port, whatever the model). */
function authFiles(config: Config): InitFile[] {
  const { http, di, authn, authz } = config.stack;
  const file = (name: string, template = name): InitFile => [`${config.platformDir}/auth/${name}`, `init/platform/auth/${template}.tpl`];
  return [
    file('authorization.ts', `authorization.${di === 'tsyringe' ? 'tsyringe' : 'manual'}.ts`),
    file('authorizer.ts', `authorizer.${authz}.ts`),
    file('access-policies.ts'),
    file('audit.ts'),
    ...(AUTHORIZATION_MODEL[authz] ?? []).map((name) => file(name)),
    ...when(http !== 'none', [file('authenticator.ts', `authenticator.${authn}.ts`), file('http-boundary.ts')]),
  ];
}

/** Storage adapters of the platform, by ORM. Each exports the same `Persistence` from persistence.ts. */
const PERSISTENCE: Readonly<Record<string, readonly (readonly [file: string, template: string])[]>> = {
  none: [['persistence.ts', 'persistence.memory.ts.tpl']],
  custom: [
    ['persistence.ts', 'persistence.memory.ts.tpl'],
    ['persistence.contract.spec.ts', 'persistence.contract.spec.ts.tpl'],
  ],
  drizzle: [
    ['persistence.ts', 'persistence.drizzle.ts.tpl'],
    ['database.ts', 'database.drizzle.ts.tpl'],
    ['schema.ts', 'schema.drizzle.ts.tpl'],
    ['testing.ts', 'testing.drizzle.ts.tpl'],
  ],
  knex: [
    ['persistence.ts', 'persistence.knex.ts.tpl'],
    ['database.ts', 'database.knex.ts.tpl'],
    ['schema.ts', 'schema.knex.ts.tpl'],
    ['testing.ts', 'testing.knex.ts.tpl'],
  ],
  prisma: [
    ['persistence.ts', 'persistence.prisma.ts.tpl'],
    ['database.ts', 'database.prisma.ts.tpl'],
    ['testing.ts', 'testing.prisma.ts.tpl'],
  ],
  typeorm: [
    ['persistence.ts', 'persistence.typeorm.ts.tpl'],
    ['database.ts', 'database.typeorm.ts.tpl'],
    ['schema.ts', 'schema.typeorm.ts.tpl'],
    ['data-source.ts', 'data-source.typeorm.ts.tpl'],
    ['testing.ts', 'testing.typeorm.ts.tpl'],
  ],
};

const TOOLING: Readonly<Record<string, InitFile[]>> = {
  drizzle: [['drizzle.config.ts', 'init/platform/database/drizzle.config.ts.tpl']],
  knex: [
    ['knexfile.js', 'init/platform/database/knexfile.js.tpl'],
    ['migrations/0001_initial.js', 'init/platform/database/migration.knex.js.tpl'],
  ],
  prisma: [
    ['prisma/schema.prisma', 'init/platform/database/schema.prisma.tpl'],
    ['prisma.config.ts', 'init/platform/database/prisma.config.ts.tpl'],
  ],
};

function persistenceFiles(config: Config): InitFile[] {
  const { orm } = config.stack;
  const files = (PERSISTENCE[orm] ?? []).map(([file, template]): InitFile => [`${config.platformDir}/database/${file}`, `init/platform/database/${template}`]);
  return [...files, ...(TOOLING[orm] ?? [])];
}

function scriptFiles(config: Config): InitFile[] {
  return [...when(config.stack.http !== 'none', [['scripts/openapi.ts', 'init/scripts/openapi.ts.tpl']]), ['scripts/events.ts', 'init/scripts/events.ts.tpl']];
}

const WITH_TEST_DATABASE = ['drizzle', 'knex', 'prisma', 'typeorm'];

/** End-to-end tests drive the application through HTTP: without an HTTP stack there is nothing to set up. */
function endToEndFiles(config: Config): InitFile[] {
  const { http, tests, orm, authn } = config.stack;
  if (http === 'none') return [];
  return [
    ['test/e2e/support/credentials.ts', `init/e2e/credentials.${authn}.ts.tpl`],
    tests === 'jest' ? ['jest.e2e.config.js', 'init/e2e/jest.e2e.config.js.tpl'] : ['vitest.e2e.config.ts', 'init/e2e/vitest.e2e.config.ts.tpl'],
    ['test/e2e/support/application.ts', `init/e2e/application.${WITH_TEST_DATABASE.includes(orm) ? 'database' : 'memory'}.ts.tpl`],
  ];
}

/** The analyzers and the git hooks: the same on every platform, and on none. */
function qualityFiles(): InitFile[] {
  return [
    ['eslint.config.mjs', 'pipeline/eslint.config.mjs.tpl'],
    ['knip.json', 'pipeline/knip.json.tpl'],
    ['lefthook.yml', 'pipeline/lefthook.yml'],
    ['commitlint.config.mjs', 'pipeline/commitlint.config.mjs'],
  ];
}

const GITHUB: readonly InitFile[] = [
  ['.github/workflows/ci.yml', 'pipeline/github/workflows/ci.yml'],
  ['.github/workflows/codeql.yml', 'pipeline/github/workflows/codeql.yml'],
  ['.github/workflows/pr-title.yml', 'pipeline/github/workflows/pr-title.yml'],
  ['.github/dependabot.yml', 'pipeline/github/dependabot.yml'],
  ['.github/branch-protection.md', 'pipeline/github/branch-protection.md'],
];

const GITLAB: readonly InitFile[] = [
  ['.gitlab-ci.yml', 'pipeline/gitlab/gitlab-ci.yml'],
  ['.gitlab/merge-request-settings.md', 'pipeline/gitlab/merge-request-settings.md'],
];

/** The pipeline of the chosen platform. Renovate serves both; Dependabot is the GitHub-native alternative. */
function pipelineFiles(config: Config): InitFile[] {
  const { ci } = config.stack;
  if (ci === 'none') return [];
  return [['renovate.json', 'pipeline/renovate.json'], ...when(ci !== 'gitlab', GITHUB), ...when(ci !== 'github', GITLAB)];
}

function guidanceFiles(): InitFile[] {
  const rules = ['domain', 'application', 'infrastructure', 'presentation', 'tests'];
  return [['CLAUDE.md', 'init/CLAUDE.md.tpl'], ...rules.map((rule): InitFile => [`.claude/rules/${rule}.md`, `init/rules/${rule}.md.tpl`])];
}
