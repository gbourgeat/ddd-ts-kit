import { CONFIG_FILE } from '../../config/index.js';
import { config } from './config.js';
import type { Fixture } from './fixture.js';
import { handler } from './handler.js';
import { PATHS } from './paths.js';
import { project } from './project.js';

const { HANDLER, PLATFORM_MODULE, PUBLISHER } = PATHS;

export const OUTBOX_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'events/outbox-required',
    name: 'a publisher on the port, a platform that hands the OutboxPublisher and keeps the bus for the relay',
    expect: 'pass',
    files: project({
      [PUBLISHER]:
        "import type { IntegrationEventPublisher } from '@ddd-ts-kit/kernel';\nexport class InvoiceIssuedPublisher {\n  constructor(private readonly publisher: IntegrationEventPublisher) {}\n}\n",
      [PLATFORM_MODULE]:
        "import { OutboxPublisher } from '@ddd-ts-kit/events';\nimport { InMemoryEventBus } from '@ddd-ts-kit/kernel';\nexport const bus = new InMemoryEventBus();\nexport const platform = { eventPublisher: new OutboxPublisher(store), relayTarget: bus };\n",
      'src/platform/events/outbox-relay.ts': 'export const outboxRelay = new OutboxRelay({ store, publisher: bus });\n',
    }),
  },
  {
    ruleId: 'events/outbox-required',
    name: 'no database: the in-memory bus alone is enough',
    expect: 'pass',
    files: project(
      { [PLATFORM_MODULE]: 'export const platform = { eventPublisher: bus };\n' },
      { [CONFIG_FILE]: config({ stack: { database: 'none', orm: 'none', events: 'in-memory' } }) },
    ),
  },
  {
    ruleId: 'events/outbox-required',
    name: 'a database without the outbox, recorded as a deviation',
    expect: 'pass',
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          stack: { events: 'in-memory' },
          deviations: [{ what: 'stack.events', adr: 'ADR-0001', reason: 'Events are advisory in this prototype.' }],
        }),
      },
    ),
  },
  {
    ruleId: 'events/outbox-required',
    name: 'a handler importing a broker client',
    expect: { file: HANDLER },
    also: ['layer/application-inward'],
    files: project(
      handler(
        "import { connect } from 'amqplib';\nexport class IssueInvoiceHandler {\n  readonly open = connect;\n}\n",
      ),
    ),
  },
  {
    ruleId: 'events/outbox-required',
    name: 'a handler publishing on the in-memory bus',
    expect: { file: HANDLER },
    files: project(
      handler(
        "import type { InMemoryEventBus } from '@ddd-ts-kit/kernel';\nexport class IssueInvoiceHandler {\n  constructor(private readonly bus: InMemoryEventBus) {}\n}\n",
      ),
    ),
  },
  {
    ruleId: 'events/outbox-required',
    name: 'a publisher that depends on the whole bus',
    expect: { file: PUBLISHER },
    also: ['domain-events/transactional-before-commit'],
    files: project({
      [PUBLISHER]:
        "import type { EventBus } from '@ddd-ts-kit/kernel';\nexport class InvoiceIssuedPublisher {\n  constructor(private readonly bus: EventBus) {}\n}\n",
    }),
  },
  {
    ruleId: 'events/outbox-required',
    name: 'a platform that hands the bus to use cases',
    expect: { file: PLATFORM_MODULE },
    files: project({
      [PLATFORM_MODULE]:
        "import { InMemoryEventBus } from '@ddd-ts-kit/kernel';\nexport const bus = new InMemoryEventBus();\nexport const platform = { eventPublisher: bus };\n",
    }),
  },
  {
    ruleId: 'events/outbox-required',
    name: 'a database with in-memory events',
    expect: { file: CONFIG_FILE },
    also: ['governance/recorded-deviation'],
    files: project({}, { [CONFIG_FILE]: config({ stack: { orm: 'drizzle', events: 'in-memory' } }) }),
  },
];
