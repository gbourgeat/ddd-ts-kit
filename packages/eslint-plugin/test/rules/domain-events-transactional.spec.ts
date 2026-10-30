import { domainEventsTransactionalBeforeCommit } from '../../src/rules/domain-events-transactional-before-commit';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester';

const RULE = 'domain-events/transactional-before-commit';
const EVENT_HANDLER = `${BILLING}/application/event-handlers/invoice-issued.event-handler.ts`;
const PUBLISHER = `${BILLING}/application/integration/publishers/invoice-issued.publisher.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;

const DECLARATIONS = "import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';\n";

const KERNEL =
  "import { ActorContext, Cache, CacheInvalidation, CachePurger, Clock, CommandBus, EventBus, ExecutionScope, IdGenerator, IntegrationEventPublisher, JobScheduler, Lock, Logger, Metrics, QueryBus, RateLimiter } from '@ddd-ts-kit/kernel';\n";

const AFTER_COMMIT = "{ phase: 'after-commit' }, ";
const UNCOVERED = 'a port of the kernel no transaction covers';

/** A handler declared with the dependency list given, after the options that follow its event. */
const declared = (list: string, options = '', body = ''): string =>
  `${DECLARATIONS}${KERNEL}@DomainEventHandler(InvoiceIssued, ${options}[${list}])\nexport class InvoiceIssuedEventHandler {${body}}`;

const before = (name: string, why: string) => ({
  messageId: 'beforeCommit' as const,
  data: { handler: 'InvoiceIssuedEventHandler', name, why },
});

const after = (name: string) => ({
  messageId: 'afterCommit' as const,
  data: { handler: 'InvoiceIssuedEventHandler', name },
});

ruleTester.run('domain-events-transactional-before-commit', domainEventsTransactionalBeforeCommit, {
  valid: [
    at(
      EVENT_HANDLER,
      declared(
        'IntegrationEventPublisher, CommandBus, QueryBus, Clock, IdGenerator, Logger, Metrics, ActorContext, ExecutionScope',
      ),
    ),
    at(
      PUBLISHER,
      declared(
        'IntegrationEventPublisher, IdGenerator',
        '',
        '\n  constructor(private readonly publisher: IntegrationEventPublisher, private readonly ids: IdGenerator) {}\n',
      ),
    ),
    at(
      EVENT_HANDLER,
      `import { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';\nimport { Pricing } from '../../domain/services/pricing.service.js';\nimport { Reminders } from '../reminders/reminders.js';\nimport { Authorizer } from '@ddd-ts-kit/auth';\n${declared('InvoiceRepository, Pricing, Reminders, Authorizer')}`,
    ),
    at(EVENT_HANDLER, `import Reminders from '../reminders/reminders.js';\n${declared('Reminders')}`),
    at(
      EVENT_HANDLER,
      `import { Mailer } from '../ports/mailer.port.js';\nimport { Money } from '../../../../shared-kernel/money.vo.js';\n${declared('Mailer, Money, Unknown')}`,
    ),
    at(
      EVENT_HANDLER,
      `import type { Redis } from 'ioredis';\nimport { SmtpMailer } from '../../infrastructure/external/smtp-mailer.adapter.js';\n${declared('CommandBus')}`,
    ),
    at(EVENT_HANDLER, declared('CacheInvalidation, CommandBus')),
    at(
      EVENT_HANDLER,
      `import { Mailer } from '../ports/mailer.port.js';\nimport { Redis } from 'ioredis';\n${declared('Cache, Lock, RateLimiter, JobScheduler, EventBus, Mailer, Redis', AFTER_COMMIT, '\n  constructor(private readonly cache: Cache) {}\n')}`,
    ),
    at(
      EVENT_HANDLER,
      `${KERNEL}export class InvoiceIssuedEventHandler {\n  constructor(private readonly cache: Cache) {}\n}`,
    ),
    at(HANDLER, `${KERNEL}export class IssueInvoiceHandler {\n  constructor(private readonly cache: Cache) {}\n}`),
    at(`${BILLING}/test/unit/invoice-issued.event-handler.spec.ts`, declared('Cache')),
    at('src/platform/events/invoice-issued.event-handler.ts', declared('Cache')),
    at(EVENT_HANDLER, declared('Cache'), { ...SAMPLE_CONFIG, rules: { [RULE]: 'off' } }),
    at(
      EVENT_HANDLER,
      declared(
        `\n  // ddd-ts-kit-disable-next-line ${RULE} -- ADR-0015: the cache entry is rebuilt on a miss\n  Cache,\n`,
      ),
    ),
  ],
  invalid: [
    {
      ...at(EVENT_HANDLER, declared('Cache, CachePurger, Lock, RateLimiter, JobScheduler, EventBus, CommandBus')),
      errors: [
        before('Cache', UNCOVERED),
        before('CachePurger', UNCOVERED),
        before('Lock', UNCOVERED),
        before('RateLimiter', UNCOVERED),
        before('JobScheduler', UNCOVERED),
        before('EventBus', UNCOVERED),
      ],
    },
    {
      ...at(
        EVENT_HANDLER,
        `import { SmtpMailer } from '../../infrastructure/external/smtp-mailer.adapter.js';\nimport { Carrier } from '../../../shipping/application/ports/carrier.port.js';\nimport { Database } from '../../../../platform/database.js';\nimport { Redis } from 'ioredis';\nimport { EventEmitter } from 'node:events';\n${declared('SmtpMailer, Carrier, Database, Redis, EventEmitter')}`,
      ),
      errors: [
        before('SmtpMailer', 'which is imported from infrastructure/'),
        before('Carrier', 'which belongs to the context shipping'),
        before('Database', 'which comes from the platform'),
        before('Redis', 'which comes from the package ioredis'),
        before('EventEmitter', 'which comes from node:events'),
      ],
    },
    {
      ...at(
        EVENT_HANDLER,
        `import type { Redis } from 'ioredis';\n${declared('Cache', '', '\n  constructor(private readonly cache: Cache, private readonly lock: Lock, private readonly redis: Redis, private readonly local: Unknown) {}\n')}`,
      ),
      errors: [
        { ...before('Cache', UNCOVERED), line: 4 },
        { ...before('Lock', UNCOVERED), line: 6 },
        { ...before('Redis', 'which comes from the package ioredis'), line: 6 },
      ],
    },
    {
      ...at(
        EVENT_HANDLER,
        `import { Cache as Entries } from '@ddd-ts-kit/kernel';\n${DECLARATIONS}@DomainEventHandler(InvoiceIssued, [Entries])\nexport class InvoiceIssuedEventHandler {}`,
      ),
      errors: [before('Entries', UNCOVERED)],
    },
    { ...at(HANDLER, declared('Cache', "{ phase: 'before-commit' }, ")), errors: [before('Cache', UNCOVERED)] },
    { ...at(EVENT_HANDLER, declared('Cache', '{ phase: PHASE }, ')), errors: [before('Cache', UNCOVERED)] },
    {
      ...at(EVENT_HANDLER, declared('Cache, IntegrationEventPublisher', AFTER_COMMIT)),
      errors: [after('IntegrationEventPublisher')],
    },
    {
      ...at(
        PUBLISHER,
        declared(
          'IdGenerator',
          AFTER_COMMIT,
          '\n  constructor(private readonly publisher: IntegrationEventPublisher, private readonly ids: IdGenerator) {}\n',
        ),
      ),
      errors: [after('IntegrationEventPublisher')],
    },
  ],
});
