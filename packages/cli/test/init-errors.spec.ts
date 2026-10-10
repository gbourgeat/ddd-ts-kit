import { describe, expect, it } from 'vitest';
import { cli, exists, read, walk } from './helpers.js';
import { initFailure } from './support/init-failure.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';
import { readJson } from './support/read-json.js';
import { textsAt } from './support/texts-at.js';

const SENTRY = ['--errors', 'sentry'];

const TRACE_OF_REPORTING =
  /@ddd-ts-kit\/sentry|@sentry\/node|SENTRY_|glitchtip|platform\/errors|ErrorReporter|DeadLetterReports/i;

const platform = (root: string, file: string): string => read(root, `src/platform/${file}`);
const reported = (...flags: readonly string[]): string => initProject(...SENTRY, ...flags);

describe('init --errors', () => {
  it('records the choice, none unless asked', () => {
    expect(jsonAt(readJson(initProject(), 'ddd-ts-kit.config.json'), 'stack', 'errors')).toBe('none');
    expect(jsonAt(readJson(reported(), 'ddd-ts-kit.config.json'), 'stack', 'errors')).toBe('sentry');
    expect(cli(initProject(), '--help').stdout).toContain('[--errors none|sentry]');
  });

  it('refuses a reporter it does not know, and names the ones it does', () => {
    const refused = initFailure('--errors', 'bugsnag');

    expect(refused.code).toBe(2);
    expect(refused.message).toBe('Unknown value "bugsnag" for --errors.');
    expect(refused.fix).toBe('Use one of: none, sentry.');
  });

  it.each([
    [['--di', 'manual', '--http', 'fastify']],
    [['--http', 'nest', '--orm', 'knex', '--broker', 'rabbitmq', '--cache', 'redis']],
    [['--http', 'none', '--orm', 'none']],
    [['--http', 'none', '--di', 'manual', '--orm', 'none']],
    [['--style', 'explicit', '--broker', 'nats', '--audit', 'off']],
    [['--orm', 'prisma', '--assembly', 'discovery', '--broker', 'kafka', '--authn', 'keycloak']],
    [['--orm', 'custom', '--tests', 'jest', '--broker', 'custom', '--authz', 'custom', '--authn', 'none']],
    [['--orm', 'typeorm', '--di', 'manual', '--broker', 'redis', '--authz', 'rebac']],
  ])('goes with every other choice of the stack (%j)', (flags) => {
    const root = reported(...flags);

    expect(read(root, 'src/main.ts')).toContain("import { errors } from '@/platform/errors.js';");
    expect(platform(root, 'errors.ts')).toContain('initSentry(');

    expect(platform(root, 'config/load-config.ts')).toContain(
      'errorReporting: readErrorReporting(env, environment, problems),',
    );
  });

  it('changes nothing of a project that reports nowhere', () => {
    const root = initProject('--broker', 'rabbitmq', '--cache', 'redis', '--context', 'billing:core');

    cli(root, 'generate', 'service', 'billing');
    cli(root, 'generate', 'worker');

    const files = walk(root).filter((file) => file !== 'ddd-ts-kit.config.json');

    expect(files.filter((file) => TRACE_OF_REPORTING.test(read(root, file)))).toEqual([]);
    expect(exists(root, 'src/platform/errors.ts')).toBe(false);
  });
});

describe('the composition root of a project that reports to Sentry or GlitchTip', () => {
  it('starts the reporter second, from the validated configuration, and reports what nothing caught', () => {
    const root = reported();
    const [first, , second] = read(root, 'src/main.ts').split('\n').slice(1);

    expect(first).toBe("import { tracing } from '@/platform/tracing.js';");
    expect(second).toBe("import { errors } from '@/platform/errors.js';");

    expect(platform(root, 'errors.ts')).toContain(
      "import { reportProcessFailures } from '@ddd-ts-kit/kernel';\nimport { initSentry } from '@ddd-ts-kit/sentry';",
    );

    expect(platform(root, 'errors.ts')).toContain(
      'export const errors = initSentry(loadConfig(process.env).errorReporting);',
    );

    expect(platform(root, 'errors.ts')).toContain('\nreportProcessFailures(errors);\n');
    expect(platform(root, 'errors.ts')).not.toContain("process.env['SENTRY");
  });

  it('binds the port of the kernel to the reporter on tsyringe: buses, jobs, HTTP, and the flush of container.stop()', () => {
    const root = reported();

    const use =
      '.use((message, next, info) =>\n      errorReportingMiddleware(resolve(ErrorReporter), foundations.scope)(message, next, info),\n    )';

    expect(read(root, 'src/main.ts')).toContain(
      'const application = composeApplication(persistence, {\n  events: inProcessEvents(),\n  errors,\n',
    );

    expect(platform(root, 'compose-application.ts')).toContain(
      '    ...(options.errors === undefined ? {} : { errorReporter: options.errors }),\n',
    );

    expect(platform(root, 'compose-application.ts')).toContain('      errors: container.resolve(ErrorReporter),\n');
    expect(platform(root, 'platform.module.ts')).toContain('  readonly errors?: ErrorReporter;\n');

    expect(platform(root, 'buses/create-command-bus.ts')).toContain(
      `return new InMemoryCommandBus()\n    ${use}\n    .use(loggingMiddleware(`,
    );

    expect(platform(root, 'buses/create-query-bus.ts')).toContain(
      `return new InMemoryQueryBus()\n    ${use}\n    .use(loggingMiddleware(`,
    );

    expect(platform(root, 'auth/http-boundary.ts')).toContain('  const report = reportHttpErrors(errors);\n');

    expect(platform(root, 'auth/http-boundary.ts')).toContain(
      'errorCode: context.problem.code,\n      });\n\n      report(error, context);\n    },',
    );
  });

  it.each([[['--di', 'manual']], [['--http', 'nest']]])(
    'wires it by hand the same way, and flushes it when the application stops (%j)',
    (flags) => {
      const root = reported(...flags);
      const create = platform(root, 'create-platform.ts');
      const compose = platform(root, 'compose-application.ts');

      expect(create).toContain('  const errors = traced.errorReporter(options.errors ?? new NoopErrorReporter());\n');

      expect(create).toContain('const observed = observing(foundations, protection.guard, traced.useCase);');

      expect(create).toContain(
        'return [\n    errorReportingMiddleware(foundations.errors, foundations.scope),\n    loggingMiddleware(foundations.logger),',
      );

      expect(create).toContain(
        'new InProcessJobScheduler({ clock, lock, scope, ids, logger, metrics, onRun: reportFailedRuns(errors) })',
      );

      expect(platform(root, 'platform.ts')).toContain('  readonly errors: ErrorReporter;\n');
      expect(compose).toContain('clock,\n      logger,\n      errors: platform.errors,\n    }),');
      expect(compose).toContain('    stop: () => stop(platform, options),\n');

      expect(compose).toContain(
        '  await platform.jobs.stop();\n  await options.events.close();\n  await platform.errors.flush(2_000);\n  await platform.logger.flush();\n}',
      );
    },
  );

  it('reports without an HTTP boundary too: the buses, the jobs and the process remain', () => {
    const root = reported('--http', 'none');

    expect(exists(root, 'src/platform/auth/http-boundary.ts')).toBe(false);
    expect(platform(root, 'compose-application.ts')).toContain('{ errorReporter: options.errors }');
    expect(platform(root, 'compose-application.ts')).not.toContain('  ErrorReporter,\n');

    expect(platform(root, 'buses/create-command-bus.ts')).toContain(
      'errorReportingMiddleware(resolve(ErrorReporter), foundations.scope)',
    );
  });

  it.each(['rabbitmq', 'kafka', 'nats', 'redis'])(
    'reports the events %s gives up, with what their handler threw',
    (broker) => {
      const root = reported('--broker', broker);
      const provider = platform(root, 'events/create-event-provider.ts');

      expect(read(root, 'src/main.ts')).toContain('  events: createEventProvider(config, errors),\n');

      expect(provider).toContain(
        'export function createEventProvider(config: AppConfig, errors: ErrorReporter = new NoopErrorReporter()): EventProvider {',
      );

      expect(provider).toContain('  const deadLetters = new DeadLetterReports(errors);\n\n  const bus = new ');
      expect(provider).toContain('...failure }));\n      deadLetters.onFailure(failure);\n    },');
      expect(provider).toContain('    forConsumer: (name) => deadLetters.observing(bus.forConsumer(name)),\n');
      expect(read(root, 'test/e2e/support/start-application.ts')).toContain('createEventProvider(config);');
    },
  );

  it('reports an event the outbox relay declares dead, and leaves a broker of your own to you', () => {
    const root = reported('--broker', 'custom');
    const relay = platform(root, 'events/start-outbox-relay.ts');

    expect(relay).toContain('  readonly errors?: ErrorReporter;\n');

    expect(relay).toContain(
      '  const deadLetters = new DeadLetterReports(options.errors ?? new NoopErrorReporter());\n\n  const relay = new OutboxRelay({',
    );

    expect(relay).toContain(
      "    onFailure: (failure) => {\n      options.logger.error('outbox relay failure', { ...failure });\n      deadLetters.onFailure(failure);\n    },",
    );

    expect(read(root, 'src/main.ts')).toContain('  logger: application.logger,\n  errors,\n});');
    expect(read(root, 'src/main.ts')).toContain('  events: createEventProvider(),\n  errors,\n');
    expect(platform(root, 'events/create-event-provider.ts')).not.toContain('DeadLetterReports');
    expect(exists(reported('--orm', 'none'), 'src/platform/events/start-outbox-relay.ts')).toBe(false);
  });
});

describe('the configuration of error reporting', () => {
  it('validates the three variables with the rest, and stays inactive without a DSN', () => {
    const root = reported();
    const loader = platform(root, 'config/load-config.ts');

    expect(platform(root, 'config/app-config.ts')).toContain('  readonly errorReporting: ErrorReportingConfig;\n');

    expect(platform(root, 'config/app-config.ts')).toContain(
      'interface ErrorReportingConfig {\n  readonly dsn?: string;\n  readonly environment: string;\n  readonly release?: string;\n',
    );

    expect(loader).toContain(
      "  const dsn = (env['SENTRY_DSN'] ?? '').trim();\n  const named = (env['SENTRY_ENVIRONMENT'] ?? '').trim();\n  const release = (env['SENTRY_RELEASE'] ?? '').trim();",
    );

    expect(loader).toContain(
      "  if (dsn !== '' && !URL.canParse(dsn)) {\n    problems.push('SENTRY_DSN must be a URL, or empty to report nothing');\n  }",
    );

    expect(loader).toContain(
      "    ...(dsn === '' ? {} : { dsn }),\n    environment: named === '' ? environment : named,\n    ...(release === '' ? {} : { release }),",
    );

    expect(loader).toContain(
      "scrubMessages: readFlag(env, { name: 'SENTRY_SCRUB_MESSAGES', fallback: false }, problems),",
    );
  });

  it('documents them in .env.example, commented out: a copied file reports nothing', () => {
    const env = read(reported(), '.env.example');

    expect(env).toContain('# SENTRY_DSN=http://<public-key>@localhost:8000/1\n');

    expect(env).toContain(
      '# SENTRY_ENVIRONMENT=development\n# SENTRY_RELEASE=\n# true removes the message of every reported error that is not a DomainError: for a tracker hosted by a third party.\n# SENTRY_SCRUB_MESSAGES=false\nGLITCHTIP_PORT=8000\n',
    );

    expect(env.split('\n').filter((line) => line.startsWith('SENTRY_'))).toEqual([]);
  });

  it('adds the adapter and the SDK it is written against to the manifest', () => {
    const dependencies = textsAt(readJson(reported(), 'package.json'), 'dependencies');

    expect(dependencies).toMatchObject({
      '@ddd-ts-kit/sentry': '^0.1.0',
      '@sentry/node': '^11.6.0',
      '@opentelemetry/api': '^1.9.1',
    });

    expect(textsAt(readJson(reported('--di', 'manual'), 'package.json'), 'dependencies')).toMatchObject({
      '@ddd-ts-kit/sentry': '^0.1.0',
      '@ddd-ts-kit/scheduling': '^0.1.0',
    });
  });
});

describe('a local GlitchTip', () => {
  it('runs behind the compose profile errors, with its own PostgreSQL and Valkey and its port from .env', () => {
    const compose = read(reported(), 'docker-compose.yml');
    const services = compose.slice(0, compose.indexOf('\nvolumes:'));

    expect(compose.split('\n')[1]).toContain('`--profile errors` to get GlitchTip');
    expect(services).toContain('\n  glitchtip:\n    image: glitchtip/glitchtip:6.2.6\n    profiles: [errors]\n');
    expect(services).toContain('\n  glitchtip-postgres:\n    image: postgres:18-alpine\n    profiles: [errors]\n');
    expect(services).toContain('\n  glitchtip-valkey:\n    image: valkey/valkey:9-alpine\n    profiles: [errors]\n');
    expect(services).toContain('      - "127.0.0.1:${GLITCHTIP_PORT:-8000}:8000"\n');
    expect(services).toContain('      GLITCHTIP_DOMAIN: http://localhost:${GLITCHTIP_PORT:-8000}\n');
    expect(services).toContain('      GLITCHTIP_BOOTSTRAP_DEV: "true"\n');
    expect(compose.slice(compose.indexOf('\nvolumes:'))).toContain('\n  glitchtip-postgres:\n');
    expect(compose.match(/profiles: \[errors\]/g)).toHaveLength(3);
  });

  it('declares its volume where the stack had none, and keeps the services added later before the volumes', () => {
    const root = reported('--orm', 'none', '--context', 'billing:core');

    expect(read(root, 'docker-compose.yml')).toMatch(/\nvolumes:\n {2}glitchtip-postgres:\n$/);
    expect(cli(root, 'generate', 'worker').code).toBe(0);
    expect(cli(root, 'generate', 'service', 'billing').code).toBe(0);

    const compose = read(root, 'docker-compose.yml');

    expect(compose.indexOf('\n  glitchtip-valkey:')).toBeLessThan(compose.indexOf('\n  worker:'));
    expect(compose.indexOf('\n  billing:')).toBeLessThan(compose.indexOf('\nvolumes:'));
  });

  it('is how the generated README says to get a DSN', () => {
    const readme = read(reported('--broker', 'rabbitmq'), 'README.md');

    expect(readme).toContain('## Error reporting');
    expect(readme).toContain('docker compose --profile errors up -d --wait');
    expect(readme).toContain("docker compose logs glitchtip | grep 'DSN:'");
    expect(readme).toContain('Put that DSN in `SENTRY_DSN` of `.env`');

    expect(readme).toContain(
      '| an integration event given up: retries exhausted, poison message, publication of the outbox relay declared dead | a delivery that fails and is retried |',
    );

    expect(readme).toContain('tracing first, error reporting second\n(`src/platform/errors.ts`)');
    expect(read(initProject(), 'README.md')).not.toContain('Error reporting');
  });
});

describe('the other entry points of a project that reports', () => {
  it('gives the worker the same reporter, second import, and nothing else to flush', () => {
    const root = reported('--broker', 'nats');

    expect(cli(root, 'generate', 'worker').code).toBe(0);

    const worker = read(root, 'src/apps/worker/main.ts');

    expect(worker.split('\n').slice(1, 4)).toEqual([
      "import { tracing } from '@/platform/tracing.js';",
      '// Imported second on purpose: a failure while the rest of the application loads is already reported.',
      "import { errors } from '@/platform/errors.js';",
    ]);

    expect(worker).toContain('  events: createEventProvider(config, errors),\n  errors,\n');
    expect(worker).toContain('  await application.stop();\n  await persistence.close();\n  await tracing.shutdown();');
  });

  it.each([[[]], [['--di', 'manual']]])(
    'gives a context run alone the same reporter, for its use cases and its relay (%j)',
    (flags) => {
      const root = reported(...flags, '--context', 'billing:core');

      expect(cli(root, 'generate', 'service', 'billing').code).toBe(0);

      const service = read(root, 'src/apps/billing/main.ts');

      expect(service.split('\n')[3]).toBe("import { errors } from '@/platform/errors.js';");
      expect(service).toContain('    events: inProcessEvents(),\n    errors,\n');
      expect(service).toContain('  logger: application.logger,\n  errors,\n});');
    },
  );

  it('writes them without a reporter in a project that has none', () => {
    const root = initProject('--context', 'billing:core');

    cli(root, 'generate', 'worker');
    cli(root, 'generate', 'service', 'billing');

    expect(read(root, 'src/apps/worker/main.ts')).not.toContain('errors');
    expect(read(root, 'src/apps/billing/main.ts')).not.toContain('errors');
  });
});
