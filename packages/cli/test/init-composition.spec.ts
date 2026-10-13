import { describe, expect, it } from 'vitest';
import { exists, read } from './helpers.js';
import { initProject } from './support/init-project.js';
import { textsAt } from './support/texts-at.js';
import { readJson } from './support/read-json.js';
import { KIT_RANGE } from './support/kit-range.js';

const platform = (root: string, file: string): string => read(root, `src/platform/${file}`);

describe('the composition root init writes, on tsyringe', () => {
  it('initialises tracing before anything else in main.ts', () => {
    const root = initProject();

    const firstStatement = read(root, 'src/main.ts')
      .split('\n')
      .find((line) => line.trim() !== '' && !line.startsWith('//'));

    expect(firstStatement).toBe("import { tracing } from '@/platform/tracing';");
    expect(platform(root, 'tracing.ts').split('\n')[0]).toBe("import { initTracing } from '@ddd-ts-kit/tracing/node';");
  });

  it('lists the kernel module, the platform module, the authorization module, then the contexts', () => {
    const composition = platform(initProject('--context', 'billing:core'), 'compose-application.ts');

    expect(composition).toContain(
      'modules: [\n      kernel(foundations, persistence, options),\n      platformModule(persistence, options),\n      guard,\n      auditModule(foundations.audit),\n      filesModule(options.files ?? new InMemoryFileStorage()),\n      ...contexts.modules,\n    ],',
    );

    expect(composition).toContain(
      'return kernelModule({\n    instrumentation: foundations.traced,\n    clock,\n    ids,\n    executionScope: scope,\n    logger,\n    metrics,\n    eventBus: bus,',
    );

    expect(composition).not.toContain('decorate');
    expect(composition).toContain("authorization: 'required',");
    expect(composition).toContain("contextModule('billing', billingDeclarations),");
    expect(composition).toContain('routes(commands, queries)');
    expect(composition).not.toContain('PUBLISHERS');
  });

  it('resolves the ports of the kernel by their class, imported as values', () => {
    const composition = platform(initProject(), 'compose-application.ts');

    expect(composition).toContain('container.resolve(Logger)');
    expect(composition).toContain('container.resolve(Authenticator)');
    expect(composition).toContain('errorMapper: container.resolve(ErrorMapper),');

    expect(composition).toMatch(
      /import \{\n {2}Cache,\n {2}Clock,\n {2}CommandBus,\n {2}EventBus,\n {2}ExecutionScope,/,
    );
  });

  it('rebinds in the platform module what needs the storage, and binds the storage under its class', () => {
    const module = platform(initProject('--docs-ui', 'scalar'), 'platform.module.ts');

    expect(module).toContain('builder.rebind(UnitOfWork).toValue(persistence.unitOfWork);');
    expect(module).toContain('builder.rebind(ProcessedEventStore).toValue(persistence.processedEvents);');
    expect(module).toContain('builder.bind(Database).toValue(persistence.database);');
    expect(module).toContain('builder.bind(OutboxStore).toValue(persistence.outbox);');
    // The outbox publisher is given to the kernel module, which puts its span around it: a port rebound here would not be observed.
    expect(module).not.toContain('IntegrationEventPublisher');

    expect(platform(initProject(), 'compose-application.ts')).toContain(
      'eventPublisher: scopedPublisher(new OutboxPublisher(persistence.outbox), scope),',
    );

    expect(module).toContain('builder.bind(ErrorMapper).toValue(createErrorMapper());');
    expect(module).toContain("import { Database } from '@/platform/database/database';");
  });

  it('observes the application through the kernel module, the policy of what leaves the process inside the span of each call', () => {
    const root = initProject('--broker', 'rabbitmq');
    const composition = platform(root, 'compose-application.ts');

    expect(platform(root, 'lay-foundations.ts')).toContain(
      "traced: traceApplication({ consumers: options.traceConsumers ?? 'continue' }),",
    );

    expect(composition).toContain('eventSubscriber: bus,');
    expect(composition).toContain('eventBus: tracedPublisher(container.resolve(EventBus)),');
    expect(composition).not.toMatch(/traceBindings|tracedSubscriber|traceUseCases/);

    expect(platform(root, 'platform.module.ts')).toContain(
      "builder.around(['external', 'gateway'], () => adapterAspects(options.resilience ?? defaultResilience));",
    );

    expect(platform(root, 'buses/create-command-bus.ts')).toContain(
      '.use((message, next, info) => resolve(UseCaseGuard).check(message, next, info))\n    .use(foundations.traced.useCase)',
    );

    expect(platform(root, 'auth/http-boundary.ts')).toContain('around: tracedRoutes(),');
    expect(exists(root, 'src/platform/decorate-bindings.ts')).toBe(false);
    expect(platform(root, 'resilience/adapter-aspects.ts')).not.toContain('traceDependency');
  });

  it('closes the event provider inside the stop of the application, before the logger is flushed', () => {
    const root = initProject('--broker', 'rabbitmq');

    expect(platform(root, 'platform.module.ts')).toContain('onStop: () => options.events.close(),');
    expect(platform(root, 'compose-application.ts')).toContain('stop: () => container.stop(),');
  });

  it('gives a handler spec a platform whose storage refuses to be used', () => {
    const module = platform(initProject('--orm', 'knex'), 'platform-test.module.ts');

    expect(module).toContain("import { KnexContext } from '@ddd-ts-kit/knex';");
    expect(module).toContain('builder.bind(KnexContext).toFactory(() => {');
    expect(module).toContain('// ddd-ts-kit:test-bindings');
  });
});

describe('the storage token of each ORM', () => {
  it.each([
    ['knex', 'KnexContext', '@ddd-ts-kit/knex'],
    ['typeorm', 'TypeOrmContext', '@ddd-ts-kit/typeorm'],
  ])('with %s is the context class of the package: the platform declares none', (orm, token, from) => {
    const root = initProject('--orm', orm);

    expect(exists(root, 'src/platform/database/database.ts')).toBe(false);
    expect(platform(root, 'platform.module.ts')).toContain(`builder.bind(${token}).toValue(persistence.database);`);
    expect(platform(root, 'platform.module.ts')).toContain(`import { ${token} } from '${from}';`);
    expect(platform(root, 'database/persistence.ts')).toContain(`readonly database: ${token};`);
  });

  it('with prisma is a class of the platform over the transaction client', () => {
    const root = initProject('--orm', 'prisma');

    expect(platform(root, 'database/database.ts')).toContain(
      'export abstract class Database extends PrismaContext<Prisma.TransactionClient> {}',
    );

    expect(platform(root, 'platform.module.ts')).toContain('builder.bind(Database).toValue(persistence.database);');
  });

  it.each([
    [
      'knex',
      ['knexfile.js', 'migrations/00000000000000_initial.js', 'src/platform/database/connect-to-database.ts'],
      '@ddd-ts-kit/knex',
    ],
    [
      'prisma',
      ['prisma/schema.prisma', 'prisma.config.ts', 'src/platform/database/create-client.ts'],
      '@ddd-ts-kit/prisma',
    ],
    [
      'typeorm',
      ['src/platform/database/data-source.ts', 'src/platform/database/create-data-source.ts'],
      '@ddd-ts-kit/typeorm',
    ],
    ['custom', ['src/platform/database/open-persistence.contract.spec.ts'], '@ddd-ts-kit/events'],
  ])('scaffolds the persistence of --orm %s', (orm, files, dependency) => {
    const root = initProject('--orm', orm);

    for (const file of files) {
      expect(exists(root, file), file).toBe(true);
    }

    expect(exists(root, 'src/platform/database/persistence.ts')).toBe(true);
    expect(exists(root, 'src/platform/database/inert-persistence.ts')).toBe(true);
    expect(textsAt(readJson(root, 'package.json'), 'dependencies')[dependency]).toBe(KIT_RANGE);
  });

  it('keeps the test database out of the build and out of production imports', () => {
    const root = initProject();

    expect(readJson(root, 'tsconfig.build.json')).toMatchObject({
      exclude: ['test', '**/test/**', '**/*.spec.ts', '**/open-test-database.ts'],
    });

    expect(read(root, '.dependency-cruiser.cjs')).toContain('(^|/)open-test-database\\\\.ts$');
  });
});

describe('the composition root init writes, by hand', () => {
  it('builds one platform and hands it to each context, with a scheduler for its jobs', () => {
    const root = initProject('--di', 'manual', '--context', 'billing:core');

    expect(platform(root, 'platform.ts')).toContain('readonly jobs: JobScheduler;');

    expect(platform(root, 'create-platform.ts')).toContain(
      'jobs: new ConfiguredJobScheduler(\n      new InProcessJobScheduler({ clock, lock, scope, ids, logger, metrics }),\n      options.jobs?.settings ?? {},\n      traced.job,\n    ),',
    );

    expect(platform(root, 'create-platform.ts')).toContain(
      'access: new PolicyAccess({ authorizer, clock, policies: accessPolicies, onDecision }),',
    );

    expect(platform(root, 'compose-application.ts')).toContain('billingModule,');

    expect(platform(root, 'compose-application.ts')).toContain(
      'const contexts = [...selection, auditModule].map((module) => module(platform));',
    );

    expect(textsAt(readJson(root, 'package.json'), 'dependencies')).toMatchObject({
      '@ddd-ts-kit/scheduling': KIT_RANGE,
    });
  });

  it('starts the jobs after the subscriptions, only where the process is told to, and stops them first', () => {
    const composition = platform(initProject('--di', 'manual'), 'compose-application.ts');

    expect(composition).toContain(
      'await options.events.start();\n\n  if (options.jobs?.start === true) {\n    await platform.jobs.start();\n  }',
    );

    expect(composition).toContain('stop: () => stop(platform, options),');

    // Nothing flushes the logger for a platform built by hand: it does, last.
    expect(composition).toContain(
      '  await platform.jobs.stop();\n  await options.events.close();\n  await platform.logger.flush();\n}',
    );
  });
});
