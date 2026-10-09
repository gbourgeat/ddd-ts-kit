import { createHttpClient, type HttpClient } from '@ddd-ts-kit/testing/e2e';
{{#if authz.rebac}}
import type { RelationTuple } from '@ddd-ts-kit/auth/rebac';
{{/if}}
import type { IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import { composeApplication } from '{{paths.e2eToPlatform}}/application.js';
{{#if authz.rebac}}
import { relationTuples } from '{{paths.e2eToPlatform}}/auth/relationships.js';
{{/if}}
import { loadConfig } from '{{paths.e2eToPlatform}}/config.js';
import { openTestDatabase } from '{{paths.e2eToPlatform}}/database/testing.js';
{{#if broker.rabbitmq}}
import { createEventProvider, inProcessEvents } from '{{paths.e2eToPlatform}}/events.js';
{{/if}}
{{#unless broker.rabbitmq}}
import { inProcessEvents } from '{{paths.e2eToPlatform}}/events.js';
{{/unless}}
import { startHttpServer } from '{{paths.e2eToPlatform}}/http-server.js';
{{#if events.outbox}}
import { startOutboxRelay } from '{{paths.e2eToPlatform}}/outbox-relay.js';
{{/if}}
import { AUTH_ENVIRONMENT, createCredentials, type TestActor } from './credentials.js';
{{#if broker.rabbitmq}}

/** Without AMQP_URL (`npm run infra:up` gives one) the events stay in the process: the same ports, no broker. */
const NO_BROKER = 'amqp://in-process/tests';
{{/if}}

/** The whole application, real adapters included, as a client and another context see it. */
export interface RunningApplication {
  readonly client: HttpClient;
  /** Subscribe here (`collectEvents`) to assert the integration events the application publishes. */
  readonly events: IntegrationEventSubscriber;
  /** A client presenting the credential of `actor`; `client` itself presents none. */
  as(actor: TestActor): Promise<HttpClient>;
{{#if authz.rebac}}
  /** Stores a relationship, as the application does when an element is created or shared. */
  relate(tuple: RelationTuple): Promise<void>;
{{/if}}
  /** Empties the database: call it before each test. */
  reset(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Starts the application on a free port. The database is PostgreSQL in process unless
 * DATABASE_URL names a migrated server (`npm run infra:up && npm run db:migrate`).
 */
export async function startApplication(): Promise<RunningApplication> {
  // An empty variable (a blank line of .env) means the same as none.
  const url = process.env['DATABASE_URL'] === '' ? undefined : process.env['DATABASE_URL'];
  const database = await openTestDatabase(url);
  const config = loadConfig({ ...process.env, ...AUTH_ENVIRONMENT, NODE_ENV: 'test', PORT: '0'{{#if broker.rabbitmq}}, AMQP_URL: brokerUrl(){{/if}}, DATABASE_URL: url ?? 'postgres://in-process/tests' });
  const credentials = await createCredentials();
  const application = composeApplication(database.persistence, { events: {{#if broker.rabbitmq}}config.amqpUrl === NO_BROKER ? inProcessEvents() : createEventProvider(config){{/if}}{{#unless broker.rabbitmq}}inProcessEvents(){{/unless}}, authenticator: credentials.authenticator });
  await application.start();
{{#if events.outbox}}
  const relay = startOutboxRelay({ store: database.persistence.outbox, publisher: application.eventBus, intervalMs: 20 });
{{/if}}
  const server = await startHttpServer(application.routes, config, application.boundary);
  const client = createHttpClient('http://127.0.0.1:' + server.port);
  return {
    client,
    events: application.eventSubscriber,
    as: async (actor) => client.withHeaders(await credentials.headersOf(actor)),
{{#if authz.rebac}}
    relate: (tuple) => relationTuples.write([tuple]),
{{/if}}
    reset: () => database.reset(),
    close: async () => {
      await server.close();
{{#if events.outbox}}
      await relay.stop();
{{/if}}
      await application.stop();
      await database.close();
    },
  };
}
{{#if broker.rabbitmq}}

function brokerUrl(): string {
  return (process.env['AMQP_URL'] ?? '') || NO_BROKER;
}
{{/if}}
