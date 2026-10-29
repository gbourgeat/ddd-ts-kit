import { describe, expect, it } from 'vitest';
import { exists, read } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';
import { sourceFiles } from './support/source-files';

/** A platform file and what it exports: the names the generated contexts and the documentation rely on. */
type Export = readonly [file: string, declaration: string];

const SHARED: readonly Export[] = [
  ['composition/compose-application.ts', 'export function composeApplication('],
  ['jobs/job-settings.ts', 'export function jobSettings('],
  ['config/app-config.ts', 'export interface AppConfig'],
  ['config/load-config.ts', 'export function loadConfig('],
  ['config/config-error.ts', 'export class ConfigError'],
  ['observability/create-logger.ts', 'export function createLogger('],
  ['events/event-provider.ts', 'export interface EventProvider'],
  ['events/in-process-events.ts', 'export function inProcessEvents('],
  ['events/start-outbox-relay.ts', 'export function startOutboxRelay('],
  ['http/start-http-server.ts', 'export async function startHttpServer('],
  ['auth/authentication/create-authenticator.ts', 'export function createAuthenticator('],
  ['auth/authorization/create-authorizer.ts', 'export function createAuthorizer('],
  ['auth/authentication/http-boundary.ts', 'export function httpBoundary('],
  ['database/persistence.ts', 'export interface Persistence'],
  ['database/open-persistence.ts', 'export function openPersistence('],
  ['database/open-test-database.ts', 'export function openTestDatabase('],
];

const TSYRINGE: readonly Export[] = [
  [
    'composition/platform.module.ts',
    'export function platformModule(persistence: Persistence, options: PlatformOptions): ContextModule',
  ],
  ['composition/platform-test.module.ts', 'export const platformTestModule = defineContextModule('],
  ['composition/lay-foundations.ts', 'export function layFoundations('],
  ['buses/create-command-bus.ts', 'export function createCommandBus('],
  ['buses/create-query-bus.ts', 'export function createQueryBus('],
  ['auth/authorization/authorization.ts', 'export function authorization('],
  ['database/database.ts', 'export abstract class Database extends DrizzleContext<PgQueryResultHKT> {}'],
];

const MANUAL: readonly Export[] = [
  ['resilience/own-policy.ts', 'export function ownPolicy('],
  ['composition/platform.ts', 'export interface Platform'],
  ['composition/platform-options.ts', 'export interface PlatformOptions'],
  [
    'composition/lay-foundations.ts',
    'export function layFoundations(persistence: Persistence, options: PlatformOptions): Foundations',
  ],
  [
    'composition/create-platform.ts',
    'export function createPlatform(persistence: Persistence, options: PlatformOptions): Platform',
  ],
  [
    'buses/create-command-bus.ts',
    'export function createCommandBus(foundations: Foundations, around: AroundCommands): InMemoryCommandBus',
  ],
  [
    'buses/create-query-bus.ts',
    'export function createQueryBus(foundations: Foundations, guard: BusMiddleware): InMemoryQueryBus',
  ],
  ['events/platform-events.ts', 'export function platformEvents('],
  ['jobs/configured-job-scheduler.ts', 'export class ConfiguredJobScheduler implements JobScheduler'],
  ['auth/authorization/use-case-protection.ts', 'export class UseCaseProtection'],
];

const GONE = [
  'application.ts',
  'tokens.ts',
  'listening-context.ts',
  'config.ts',
  'events.ts',
  'resilience.ts',
  'observability.ts',
  'http-server.ts',
  'cache.ts',
  'outbox-relay.ts',
  'database/testing.ts',
];

describe('the platform init writes', () => {
  it.each([...SHARED, ...TSYRINGE])(
    'on tsyringe, %s holds its one export, named after the file',
    (file, declaration) => {
      const root = initProject();

      expect(read(root, `src/platform/${file}`)).toContain(declaration);
    },
  );

  it.each([...SHARED, ...MANUAL])(
    'wired by hand, %s holds its one export, named after the file',
    (file, declaration) => {
      const root = initProject('--di', 'manual');

      expect(read(root, `src/platform/${file}`)).toContain(declaration);
    },
  );

  it.each([
    [[]],
    [['--di', 'manual']],
    [['--http', 'nest']],
    [['--broker', 'rabbitmq', '--cache', 'redis', '--authz', 'rebac']],
  ])('leaves nothing of the former platform files (%j)', (flags) => {
    const root = initProject(...flags);

    for (const file of GONE) {
      expect(exists(root, `src/platform/${file}`), file).toBe(false);
    }

    expect(exists(root, 'src/platform/composition/platform.module.ts')).toBe(
      !flags.includes('manual') && !flags.includes('nest'),
    );

    expect(exists(root, 'src/platform/composition/platform.ts')).toBe(
      flags.includes('manual') || flags.includes('nest'),
    );
  });

  it('gives the Nest application its module, next to the server that mounts the routes', () => {
    const root = initProject('--http', 'nest', '--routes', 'controllers');

    expect(read(root, 'src/platform/http/create-app-module.ts')).toContain(
      'export function createAppModule(routes: readonly Route[], boundary: HttpBoundary): DynamicModule',
    );

    expect(read(root, 'src/platform/http/start-http-server.ts')).toContain(
      "import { createAppModule } from '@/platform/http/create-app-module';",
    );
  });

  it('keeps the bytes of a body for a controller that declares rawBody, on Express and on Nest', () => {
    const express = read(initProject(), 'src/platform/http/start-http-server.ts');
    const nest = read(initProject('--http', 'nest'), 'src/platform/http/start-http-server.ts');

    const nestWithControllers = read(
      initProject('--http', 'nest', '--routes', 'controllers'),
      'src/platform/http/start-http-server.ts',
    );

    expect(express).toContain('Object.assign(request, { rawBody: bytes })');
    expect(nest).toContain('rawBody: true');
    expect(nestWithControllers).toContain('rawBody: true');
  });

  it.each([
    ['express', 'app.use(problemErrorHandler({ logger: served.logger }));'],
    ['fastify', 'app.setErrorHandler(problemErrorHandler({ logger: served.logger }));'],
    ['hono', 'app.onError(problemErrorHandler({ logger: served.logger }));'],
    ['nest', 'app.useGlobalFilters(new ProblemExceptionFilter(app.getHttpAdapter(), { logger: served.logger }));'],
  ])('answers what %s refuses before a route as a problem, logged without the body', (http, installed) => {
    const server = read(initProject('--http', http), 'src/platform/http/start-http-server.ts');

    expect(server).toContain(installed);
  });

  it('answers a failed limit of the callers as a problem, on Express and on Nest', () => {
    const express = read(initProject('--cache', 'redis'), 'src/platform/http/start-http-server.ts');
    const nest = read(initProject('--http', 'nest', '--cache', 'redis'), 'src/platform/http/start-http-server.ts');

    expect(express.indexOf('limitEachCaller(app, served, config);')).toBeLessThan(
      express.indexOf('app.use(problemErrorHandler('),
    );

    expect(express).toContain('}, next);');
    expect(nest.match(/\}, next\);/g)).toHaveLength(2);
  });

  it('makes a Nest project validate with class-validator and write its routes as Nest controllers, unless told otherwise', () => {
    const nest = readJson(initProject('--http', 'nest'), 'ddd-ts-kit.config.json');
    const zod = readJson(initProject('--http', 'nest', '--validation', 'zod'), 'ddd-ts-kit.config.json');

    expect([jsonAt(nest, 'stack', 'validation'), jsonAt(nest, 'stack', 'routes')]).toEqual(['class-validator', 'nest']);
    expect([jsonAt(zod, 'stack', 'validation'), jsonAt(zod, 'stack', 'routes')]).toEqual(['zod', 'controllers']);
  });

  it('verifies the bearer tokens with a strategy of Passport under --authn passport, its end-to-end credentials signed for it', () => {
    const root = initProject('--http', 'nest', '--authn', 'passport');
    const manifest = readJson(root, 'package.json');

    expect(read(root, 'src/platform/auth/authentication/create-authenticator.ts')).toContain(
      'return passportAuthenticator(bearerStrategy(config.auth), { actorOf: actorOfToken });',
    );

    expect(read(root, 'src/platform/auth/authentication/bearer-strategy.ts')).toContain('passportJwtSecret({');
    expect(read(root, 'src/platform/auth/authentication/actor-of-token.ts')).toContain('actorOfClaims({ ...payload })');
    expect(read(root, 'test/e2e/support/create-credentials.ts')).toContain('passportAuthenticator(strategy');
    expect(read(root, '.env.example')).toContain('AUTH_JWKS_URI=');
    expect(jsonAt(manifest, 'dependencies', 'passport-jwt')).toBe('^4.0.1');
    expect(jsonAt(manifest, 'devDependencies', 'jose')).toBe('^6.0.0');
  });

  it('names the end-to-end support after what each file exports', () => {
    const root = initProject();

    expect(read(root, 'test/e2e/support/start-application.ts')).toContain(
      'export async function startApplication(): Promise<RunningApplication>',
    );

    expect(read(root, 'test/e2e/support/create-credentials.ts')).toContain(
      'export async function createCredentials(): Promise<Credentials>',
    );

    expect(read(root, 'test/e2e/support/auth-environment.ts')).toContain('export const authEnvironment');
    expect(read(root, 'test/e2e/support/test-environment.ts')).toContain('export function testEnvironment(');
  });
});

const STACKS: readonly (readonly string[])[] = [
  [],
  ['--style', 'explicit'],
  ['--di', 'manual', '--orm', 'knex', '--authz', 'abac'],
  ['--http', 'nest', '--orm', 'none'],
  ['--http', 'fastify', '--authn', 'none', '--authz', 'custom', '--broker', 'custom'],
  ['--orm', 'knex', '--authn', 'keycloak', '--authz', 'rebac', '--broker', 'redis', '--cache', 'redis'],
  ['--orm', 'typeorm', '--broker', 'kafka', '--audit', 'off'],
  ['--orm', 'prisma', '--http', 'none', '--broker', 'nats'],
];

const OWN = ['src/platform', 'src/main.ts', 'scripts', 'test/e2e/support'];

describe('the style of what init writes', () => {
  it.each(STACKS.map((flags) => [flags]))(
    'has no token helper, no injection constant and no token file (%j)',
    (flags) => {
      const files = sourceFiles(initProject(...flags), ...OWN);

      for (const { path, text } of files) {
        expect(text, path).not.toMatch(/\btoken(<[^>]*>)?\(/);
        expect(text, path).not.toMatch(/\b(bind|rebind|resolve|toClass|handledBy)\(\s*[A-Z][A-Z0-9]*_[A-Z0-9_]*\b/);
        expect(text, path).not.toMatch(/\[[A-Z][A-Z0-9]*_[A-Z0-9_]*(, [A-Z0-9_]+)*\]\)/);
      }

      expect(files.map((file) => file.path).filter((path) => /(^|\/)tokens\.ts$|\.ports\.ts$/.test(path))).toEqual([]);
    },
  );

  it.each(STACKS.map((flags) => [flags]))(
    'keeps members private without the hash, and every file far below the size limit (%j)',
    (flags) => {
      for (const { path, text } of sourceFiles(initProject(...flags), ...OWN)) {
        expect(text, path).not.toMatch(/^\s+(readonly |static )*#[a-zA-Z]/m);
        expect(text, path).not.toMatch(/this\.#[a-zA-Z]/);
        expect(text.split('\n').length, path).toBeLessThan(220);
      }
    },
  );

  it.each(STACKS.map((flags) => [flags]))(
    'leaves a blank line before a return that is not alone in its block (%j)',
    (flags) => {
      for (const { path, text } of sourceFiles(initProject(...flags), ...OWN)) {
        const lines = text.split('\n');

        const crowded = lines.filter(
          (line, index) => /^\s*return\b/.test(line) && !/^\s*$|[{:]$|^\s*\/\//.test(lines[index - 1] ?? ''),
        );

        expect(crowded, path).toEqual([]);
      }
    },
  );

  it.each(STACKS.map((flags) => [flags]))('names a file after its one exported class or function (%j)', (flags) => {
    for (const { path, text } of sourceFiles(initProject(...flags), 'src/platform')) {
      const counted = [
        ...text.matchAll(/^export (?:default )?(?:abstract )?(?:async )?(?:class|function) (\w+)/gm),
      ].map((match) => match[1] ?? '');

      const stem = (path.split('/').at(-1) ?? '').replace(/\.ts$/, '').replaceAll('.', '-');

      expect(counted.length, path).toBeLessThanOrEqual(1);

      for (const name of counted) {
        expect(kebab(name), path).toBe(stem);
      }
    }
  });
});

function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}
