import { eventsConsumerIdempotent } from '../../src/rules/events-consumer-idempotent.js';
import { eventsOutboxRequired } from '../../src/rules/events-outbox-required.js';
import { at, BILLING, ruleTester } from '../support/rule-tester.js';

const MODULE = `${BILLING}/billing.module.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const PUBLISHER = `${BILLING}/application/integration/publishers/invoice-issued.publisher.ts`;
const INTEGRATION_HANDLER = `${BILLING}/application/integration/handlers/product-listed.integration-handler.ts`;
const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const ADAPTER = `${BILLING}/infrastructure/external/rabbit.publisher.ts`;
const SPEC = `${BILLING}/test/unit/invoice-issued.publisher.spec.ts`;

ruleTester.run('events-outbox-required', eventsOutboxRequired, {
  valid: [
    at(PUBLISHER, "import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';\nexport class InvoiceIssuedPublisher { constructor(private readonly publisher: IntegrationEventPublisher, private readonly ids: IdGenerator) {} }"),
    at(HANDLER, 'class IssueInvoiceHandler { constructor(private readonly events: EventBus) {} }'),
    at(ADAPTER, "import amqp from 'amqplib';\nimport { OutboxPublisher } from '@ddd-ts-kit/events';"),
    at(MODULE, "import { OutboxRelay } from '@ddd-ts-kit/events';"),
    at(SPEC, "import { InMemoryEventBus } from '@ddd-ts-kit/kernel';"),
    at('src/platform/events/relay.ts', "import { Kafka } from 'kafkajs';"),
    { ...at(HANDLER, "import { Kafka } from 'kafkajs';"), options: [{ brokerPackages: ['bullmq'] }] },
  ],
  invalid: [
    { ...at(HANDLER, "import amqp from 'amqplib';"), errors: [{ messageId: 'broker', data: { name: 'amqplib', layer: 'application' } }] },
    { ...at(AGGREGATE, "import { SQSClient } from '@aws-sdk/client-sqs';"), errors: [{ messageId: 'broker', data: { name: '@aws-sdk/client-sqs', layer: 'domain' } }] },
    { ...at(HANDLER, "const { connect } = await import('nats');"), errors: [{ messageId: 'broker' }] },
    { ...at(HANDLER, "import { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';"), errors: [{ messageId: 'broker' }] },
    { ...at(HANDLER, "import { Queue } from 'bullmq';"), options: [{ brokerPackages: ['bullmq'] }], errors: [{ messageId: 'broker', data: { name: 'bullmq', layer: 'application' } }] },
    { ...at(HANDLER, "import { InMemoryEventBus, type Clock } from '@ddd-ts-kit/kernel';"), errors: [{ messageId: 'concreteBus', data: { name: 'InMemoryEventBus', layer: 'application' } }] },
    { ...at(PUBLISHER, "import type { OutboxPublisher, OutboxRelay as Relay } from '@ddd-ts-kit/events';"), errors: [{ messageId: 'concreteBus', data: { name: 'OutboxPublisher', layer: 'application' } }, { messageId: 'concreteBus', data: { name: 'OutboxRelay', layer: 'application' } }] },
    { ...at(PUBLISHER, 'export class InvoiceIssuedPublisher { constructor(private readonly bus: EventBus, private readonly ids: IdGenerator) {} }'), errors: [{ messageId: 'publisherDependency', data: { className: 'InvoiceIssuedPublisher', type: 'EventBus' } }] },
    { ...at(PUBLISHER, 'export class InvoiceIssuedPublisher { constructor(bus: rabbit.RabbitMqEventBus, relay: OutboxRelay = make()) {} }'), errors: [{ messageId: 'publisherDependency', data: { className: 'InvoiceIssuedPublisher', type: 'RabbitMqEventBus' } }, { messageId: 'publisherDependency', data: { className: 'InvoiceIssuedPublisher', type: 'OutboxRelay' } }] },
  ],
});

ruleTester.run('events-consumer-idempotent', eventsConsumerIdempotent, {
  valid: [
    at(MODULE, "builder.on(productListedV1, { consumer: 'billing.price-list' }).handledBy(ProductListedHandler, [CommandBus]);"),
    at(MODULE, 'builder.on(productListedV1, { consumer: PRICE_LIST }).handledBy(ProductListedHandler);'),
    at(MODULE, 'builder.on(productListedV1, options).handledBy(ProductListedHandler);'),
    at(MODULE, 'builder.on(productListedV1, { ...shared }).handledBy(ProductListedHandler);'),
    at(MODULE, "emitter.on('close', () => stop());"),
    at(MODULE, "import { on, subscribeAll } from '@ddd-ts-kit/events';\nsubscribeAll(platform.subscriber, [on(productListedV1, (event) => consumer.handle(event), { consumer: 'billing.price-list', processed: platform.persistence.processedEvents })]);"),
    at(MODULE, "import { consume } from '@ddd-ts-kit/events';\nconsume(productListedV1, { consumer: 'billing.price-list', processed, unitOfWork }, handle);"),
    at(MODULE, "import { on } from 'node:events';\non(emitter, 'tick');"),
    at(MODULE, 'function on(a: A, b: B): void {}\non(productListedV1, handle);'),
    at(MODULE, "resolve(IntegrationEventSubscriber).subscribe(ProductListedHandler.eventType, idempotent('billing.price-list', resolve(ProcessedEventStore), (event) => resolve(ProductListedHandler).handle(event)));"),
    at(ADAPTER, "await this.channel.subscribe('queue', handler);"),
    at('src/platform/events/wiring.ts', 'subscriber.subscribe(type, handler);'),
    at(`${BILLING}/test/integration/product-listed.integration-handler.spec.ts`, "import { on } from '@ddd-ts-kit/events';\nbus.subscribe('x', handler);\non(productListedV1, handler);"),
  ],
  invalid: [
    { ...at(MODULE, 'builder.on(productListedV1).handledBy(ProductListedHandler, [CommandBus]);'), errors: [{ messageId: 'consumerName', data: { context: 'billing' } }] },
    { ...at(MODULE, 'builder.on(productListedV1, {}).handledByFactory((resolve) => new ProductListedHandler(resolve(CommandBus)));'), errors: [{ messageId: 'consumerName' }] },
    { ...at(MODULE, "builder.on(productListedV1, { consumer: '' }).handledBy(ProductListedHandler);"), errors: [{ messageId: 'consumerName' }] },
    { ...at(MODULE, "import { on } from '@ddd-ts-kit/events';\non(productListedV1, (event) => consumer.handle(event));"), errors: [{ messageId: 'subscription', data: { missing: '`consumer` and `processed`', context: 'billing' } }] },
    { ...at(MODULE, "import { on as reactTo } from '@ddd-ts-kit/events';\nreactTo(productListedV1, handle, { consumer: 'billing.price-list' });"), errors: [{ messageId: 'subscription', data: { missing: '`processed`', context: 'billing' } }] },
    { ...at(INTEGRATION_HANDLER, "import { on } from '@ddd-ts-kit/events';\nexport const subscription = on(productListedV1, handle, { processed });"), errors: [{ messageId: 'subscription', data: { missing: '`consumer`', context: 'billing' } }] },
    { ...at(MODULE, 'resolve(IntegrationEventSubscriber).subscribe(ProductListedHandler.eventType, (event) => resolve(ProductListedHandler).handle(event));'), errors: [{ messageId: 'directSubscribe', data: { call: 'resolve(IntegrationEventSubscriber).subscribe', context: 'billing' } }] },
    { ...at(INTEGRATION_HANDLER, "this.subscriber.subscribe('catalog.product.listed', (event) => this.handle(event));"), errors: [{ messageId: 'directSubscribe' }] },
  ],
});
