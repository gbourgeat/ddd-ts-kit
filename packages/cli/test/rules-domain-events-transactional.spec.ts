import { describe, expect, it } from 'vitest';
import { lines, projectWith, reported } from './rules-support.js';

const RULE = 'domain-events/transactional-before-commit';
const BILLING = 'src/contexts/billing';
const EVENT_HANDLER = `${BILLING}/application/event-handlers/invoice-issued.event-handler.ts`;
const PUBLISHER = `${BILLING}/application/integration/publishers/invoice-issued.publisher.ts`;
const MODULE = `${BILLING}/billing.module.ts`;
const EXTERNAL = `${BILLING}/infrastructure/external/smtp-mailer.adapter.ts`;
const PERSISTED = `${BILLING}/infrastructure/persistence/knex-mailer.repository.ts`;
const DECLARATIONS = "import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';";
const MAILER = "import { Mailer } from '../ports/mailer.port.js';";

const ADAPTER = lines(
  "import { Mailer } from '../../application/ports/mailer.port.js';",
  '',
  'export class StoredMailer implements Mailer {}',
);

const BEFORE = 'runs before the commit and depends on';

describe('domain-events/transactional-before-commit', () => {
  it('refuses a before-commit handler what no rollback undoes: five kernel ports, an adapter, another context, the platform, a package', () => {
    const imports = [
      "import { Cache, EventBus, JobScheduler, Lock, RateLimiter } from '@ddd-ts-kit/kernel';",
      "import { SmtpMailer } from '../../infrastructure/external/smtp-mailer.adapter.js';",
      "import { Carrier } from '../../../shipping/application/ports/carrier.port.js';",
      "import { Database } from '../../../../platform/database.js';",
      "import { Redis } from 'ioredis';",
    ];

    const handler = declared(imports, [
      'Cache',
      'Lock',
      'RateLimiter',
      'JobScheduler',
      'EventBus',
      'SmtpMailer',
      'Carrier',
      'Database',
      'Redis',
    ]);

    expect(found({ [EVENT_HANDLER]: handler })).toEqual([
      `event-handlers/invoice-issued.event-handler.ts:8 InvoiceIssuedEventHandler ${BEFORE} Cache, a port of the kernel no transaction covers`,
      `event-handlers/invoice-issued.event-handler.ts:8 InvoiceIssuedEventHandler ${BEFORE} Lock, a port of the kernel no transaction covers`,
      `event-handlers/invoice-issued.event-handler.ts:8 InvoiceIssuedEventHandler ${BEFORE} RateLimiter, a port of the kernel no transaction covers`,
      `event-handlers/invoice-issued.event-handler.ts:8 InvoiceIssuedEventHandler ${BEFORE} JobScheduler, a port of the kernel no transaction covers`,
      `event-handlers/invoice-issued.event-handler.ts:8 InvoiceIssuedEventHandler ${BEFORE} EventBus, a port of the kernel no transaction covers`,
      `event-handlers/invoice-issued.event-handler.ts:8 InvoiceIssuedEventHandler ${BEFORE} SmtpMailer, which is imported from infrastructure/`,
      `event-handlers/invoice-issued.event-handler.ts:8 InvoiceIssuedEventHandler ${BEFORE} Carrier, which belongs to the context shipping`,
      `event-handlers/invoice-issued.event-handler.ts:8 InvoiceIssuedEventHandler ${BEFORE} Database, which comes from the platform`,
      `event-handlers/invoice-issued.event-handler.ts:8 InvoiceIssuedEventHandler ${BEFORE} Redis, which comes from the package ioredis`,
    ]);
  });

  it('lets a before-commit handler depend on its domain, the other kernel ports, the auth package and application helpers', () => {
    const imports = [
      "import { ActorContext, Clock, CommandBus, ExecutionScope, IdGenerator, IntegrationEventPublisher, Logger, Metrics, QueryBus } from '@ddd-ts-kit/kernel';",
      "import { Authorizer } from '@ddd-ts-kit/auth';",
      "import { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';",
      "import { Pricing } from '../../domain/services/pricing.service.js';",
      "import { Reminders } from '../reminders/reminders.js';",
      "import type { Redis } from 'ioredis';",
    ];

    const handler = declared(imports, [
      'InvoiceRepository',
      'Pricing',
      'Reminders',
      'IntegrationEventPublisher',
      'CommandBus',
      'QueryBus',
      'Clock',
      'IdGenerator',
      'Logger',
      'Metrics',
      'ActorContext',
      'ExecutionScope',
      'Authorizer',
    ]);

    expect(
      found({
        [EVENT_HANDLER]: handler,
        [PUBLISHER]: handler.replace('InvoiceIssuedEventHandler', 'InvoiceIssuedPublisher'),
      }),
    ).toEqual([]);
  });
});

describe('domain-events/transactional-before-commit, ports, phases and where a dependency is read', () => {
  it('takes a port of application/ports for transactional only when every adapter of it lives under infrastructure/persistence', () => {
    const handler = declared([MAILER], ['Mailer']);

    const fake = {
      [`${BILLING}/test/fakes/fake-mailer.ts`]: ADAPTER,
      [`${BILLING}/infrastructure/external/smtp-mailer.adapter.spec.ts`]: ADAPTER,
    };

    expect(found({ [EVENT_HANDLER]: handler, [EXTERNAL]: ADAPTER })).toEqual([
      `event-handlers/invoice-issued.event-handler.ts:4 InvoiceIssuedEventHandler ${BEFORE} Mailer, whose adapter is under infrastructure/external/`,
    ]);

    expect(found({ [EVENT_HANDLER]: handler, ...fake })).toEqual([
      `event-handlers/invoice-issued.event-handler.ts:4 InvoiceIssuedEventHandler ${BEFORE} Mailer, which has no adapter under infrastructure/persistence/`,
    ]);

    expect(found({ [EVENT_HANDLER]: handler, [PERSISTED]: ADAPTER, [EXTERNAL]: ADAPTER })).toHaveLength(1);

    expect(
      found({
        [EVENT_HANDLER]: handler,
        [PERSISTED]: ADAPTER,
        [`${BILLING}/infrastructure/mailer.ts`]: ADAPTER.replace('../../application', '../application'),
      }),
    ).toEqual([
      `event-handlers/invoice-issued.event-handler.ts:4 InvoiceIssuedEventHandler ${BEFORE} Mailer, whose adapter is under infrastructure/`,
    ]);

    expect(found({ [EVENT_HANDLER]: handler, [PERSISTED]: ADAPTER, ...fake })).toEqual([]);

    expect(
      found({
        [EVENT_HANDLER]: handler,
        [PERSISTED]: ADAPTER,
        [`${BILLING}/infrastructure/external/other.adapter.ts`]: ADAPTER.replace(
          '../../application/ports/mailer.port.js',
          'nodemailer',
        ),
      }),
    ).toEqual([]);
  });

  it('judges an after-commit handler on the outbox publisher alone', () => {
    const imports = [
      "import { Cache, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';",
      MAILER,
      "import { Redis } from 'ioredis';",
    ];

    const handler = declared(
      imports,
      ['Cache', 'Mailer', 'Redis', 'IntegrationEventPublisher'],
      "phase: 'after-commit'",
    );

    const [violation] = reported(projectWith({ [EVENT_HANDLER]: handler }), RULE);

    expect(reported(projectWith({ [EVENT_HANDLER]: handler }), RULE)).toHaveLength(1);

    expect(violation?.message).toBe(
      'InvoiceIssuedEventHandler runs after the commit and depends on IntegrationEventPublisher: the event it publishes would be committed apart from the state change it announces.',
    );

    expect(found({ [EVENT_HANDLER]: declared(imports, ['Cache'], 'phase: PHASE') })).toHaveLength(1);
    expect(found({ [EVENT_HANDLER]: declared(imports, ['Cache'], "phase: 'before-commit'") })).toHaveLength(1);
  });

  it('reads a dependency once, from the list of the decorator, the constructor and a toClass list, wherever the class is declared', () => {
    const elsewhere = `${BILLING}/application/commands/issue-invoice/invoice-issued.reaction.ts`;

    const handler = lines(
      "import * as kernel from '@ddd-ts-kit/kernel';",
      "import { Cache, type Lock } from '@ddd-ts-kit/kernel';",
      DECLARATIONS,
      '',
      '@DomainEventHandler(InvoiceIssued, [Cache])',
      'export class InvoiceIssuedReaction {',
      '  constructor(',
      '    private readonly cache: Cache,',
      '    private readonly lock: Lock,',
      '    private readonly limiter: kernel.RateLimiter,',
      '    private readonly local: Unknown,',
      '  ) {}',
      '}',
      '',
      'builder.bind(InvoiceIssuedReaction).toClass(InvoiceIssuedReaction, [kernel.Cache, JobScheduler]);',
      'builder.bind(Other).toClass(Other, [Lock]);',
    );

    expect(found({ [elsewhere]: handler })).toEqual([
      `commands/issue-invoice/invoice-issued.reaction.ts:5 InvoiceIssuedReaction ${BEFORE} Cache, a port of the kernel no transaction covers`,
      `commands/issue-invoice/invoice-issued.reaction.ts:7 InvoiceIssuedReaction ${BEFORE} Lock, a port of the kernel no transaction covers`,
      `commands/issue-invoice/invoice-issued.reaction.ts:7 InvoiceIssuedReaction ${BEFORE} RateLimiter, a port of the kernel no transaction covers`,
    ]);
  });
});

describe('domain-events/transactional-before-commit, explicit style and scope', () => {
  it('explicit style: reads the phase in the module file, by the class or the variable that holds it', () => {
    const byVariable = (options: string): string =>
      lines(
        "const invoiceIssuedEventHandler = platform.adapter(new InvoiceIssuedEventHandler(platform.cache), { kind: 'domain-event-handler', context: 'billing' });",
        '',
        "platform.domainEvents.on('billing.invoice.issued', async (event) => {",
        '  if (event instanceof InvoiceIssued) await invoiceIssuedEventHandler.handle(event);',
        `}${options});`,
      );

    const byClass = (options: string): string =>
      lines(
        "resolve(DomainEventDispatcher).on('billing.invoice.issued', async (event) => {",
        '  if (event instanceof InvoiceIssued) await resolve(InvoiceIssuedEventHandler).handle(event);',
        `}${options});`,
      );

    const after = ", { phase: 'after-commit' }";

    const flagged = [
      `event-handlers/invoice-issued.event-handler.ts:4 InvoiceIssuedEventHandler ${BEFORE} Cache, a port of the kernel no transaction covers`,
    ];

    expect(found({ [EVENT_HANDLER]: PLAIN, [MODULE]: byVariable(after) })).toEqual([]);
    expect(found({ [EVENT_HANDLER]: PLAIN, [MODULE]: byClass(after) })).toEqual([]);
    expect(found({ [EVENT_HANDLER]: PLAIN, [MODULE]: byVariable('') })).toEqual(flagged);
    expect(found({ [EVENT_HANDLER]: PLAIN, [MODULE]: byClass(", { phase: 'before-commit' }") })).toEqual(flagged);
    expect(found({ [EVENT_HANDLER]: PLAIN, [MODULE]: `${byVariable(after)}${byClass('')}` })).toEqual(flagged);

    expect(
      found({
        [EVENT_HANDLER]: PLAIN,
        [MODULE]: byClass(after).replaceAll('InvoiceIssuedEventHandler', 'InvoicePaidEventHandler'),
      }),
    ).toEqual(flagged);

    expect(found({ [EVENT_HANDLER]: PLAIN })).toEqual(flagged);
  });

  it('explicit style: reads the list the module file binds the class with, and reports it at the class', () => {
    const publisher = lines('export class InvoiceIssuedPublisher {', '  async handle(): Promise<void> {}', '}');

    const module = lines(
      "import { EventBus, IdGenerator } from '@ddd-ts-kit/kernel';",
      "import { InvoiceIssuedPublisher } from './application/integration/publishers/invoice-issued.publisher.js';",
      '',
      "builder.bind(InvoiceIssuedPublisher).toClass(InvoiceIssuedPublisher, [EventBus, IdGenerator]).as('domain-event-handler');",
    );

    expect(found({ [PUBLISHER]: publisher, [MODULE]: module })).toEqual([
      `integration/publishers/invoice-issued.publisher.ts:1 InvoiceIssuedPublisher ${BEFORE} EventBus, a port of the kernel no transaction covers`,
    ]);
  });

  it('does not judge tests, classes that handle no domain event, nor files outside a context', () => {
    const handler = declared(["import { Cache } from '@ddd-ts-kit/kernel';"], ['Cache']);

    const files = {
      [`${BILLING}/test/unit/invoice-issued.event-handler.spec.ts`]: handler,
      [`${BILLING}/application/event-handlers/invoice-issued.event-handler.spec.ts`]: handler,
      [`${BILLING}/application/event-handlers/invoice-issued.ts`]: PLAIN,
      [`${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`]: PLAIN,
      [`${BILLING}/application/integration/handlers/product-listed.integration-handler.ts`]: PLAIN,
      'src/platform/events/invoice-issued.event-handler.ts': PLAIN,
    };

    expect(found(files)).toEqual([]);
  });

  it('leaves the adapters of a port to the whole project, says what to write instead, and obeys the config and a suppression', () => {
    const root = projectWith({
      [EVENT_HANDLER]: declared(["import { Cache } from '@ddd-ts-kit/kernel';", MAILER], ['Cache', 'Mailer']),
      [EXTERNAL]: ADAPTER,
    });

    const suppressed = PLAIN.replace(
      '  constructor',
      `  // ddd-ts-kit-disable-next-line ${RULE} -- ADR-0015: the cache entry is rebuilt on a miss\n  constructor`,
    );

    expect(reported(root, RULE)).toHaveLength(2);

    expect(reported(root, RULE, EVENT_HANDLER).map(({ message }) => message)).toEqual([
      'InvoiceIssuedEventHandler runs before the commit and depends on Cache, a port of the kernel no transaction covers: its effect would survive a rollback.',
    ]);

    expect(
      reported(projectWith({ [EVENT_HANDLER]: suppressed, 'docs/adr/0015-cache.md': '# Decision\n' }), RULE),
    ).toEqual([]);

    expect(reported(projectWith({ [EVENT_HANDLER]: PLAIN }, { rules: { [RULE]: 'off' } }), RULE)).toEqual([]);
  });
});

const PLAIN = lines(
  "import type { Cache } from '@ddd-ts-kit/kernel';",
  '',
  'export class InvoiceIssuedEventHandler {',
  '  constructor(private readonly cache: Cache) {}',
  '}',
);

/** A handler declared with the dependencies listed, its decorator on the line after the imports and a blank one. */
function declared(imports: readonly string[], dependencies: readonly string[], option?: string): string {
  const options = ["name: 'billing.invoice.issued'", ...(option === undefined ? [] : [option])].join(', ');

  return lines(
    DECLARATIONS,
    ...imports,
    '',
    `@DomainEventHandler(InvoiceIssued, { ${options} }, [${dependencies.join(', ')}])`,
    'export class InvoiceIssuedEventHandler {}',
  );
}

function found(files: Readonly<Record<string, string>>): string[] {
  return reported(projectWith(files), RULE).map(
    ({ file, line, message }) =>
      `${file.slice(`${BILLING}/application/`.length)}:${line} ${message.slice(0, message.indexOf(': its effect'))}`,
  );
}
