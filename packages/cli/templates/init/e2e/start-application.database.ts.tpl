{{#if authz.rebac}}
import type { RelationTuple } from '@ddd-ts-kit/auth/rebac';
{{/if}}
import type { IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import { createHttpClient, type HttpClient } from '@ddd-ts-kit/testing/e2e';
{{#if authz.rebac}}
import { relationTuples } from '{{paths.e2eToPlatform}}/auth/relation-tuples.js';
{{/if}}
import { composeApplication } from '{{paths.e2eToPlatform}}/compose-application.js';
{{#if broker.provided}}
import type { AppConfig } from '{{paths.e2eToPlatform}}/config/app-config.js';
{{/if}}
import { loadConfig } from '{{paths.e2eToPlatform}}/config/load-config.js';
import { openTestDatabase } from '{{paths.e2eToPlatform}}/database/open-test-database.js';
{{#if broker.provided}}
import { createEventProvider } from '{{paths.e2eToPlatform}}/events/create-event-provider.js';
import type { EventProvider } from '{{paths.e2eToPlatform}}/events/event-provider.js';
{{/if}}
import { inProcessEvents } from '{{paths.e2eToPlatform}}/events/in-process-events.js';
{{#if events.outbox}}
import { startOutboxRelay } from '{{paths.e2eToPlatform}}/events/start-outbox-relay.js';
{{/if}}
import { startHttpServer } from '{{paths.e2eToPlatform}}/http/start-http-server.js';
{{#if cache.redis}}
import { openRedis } from '{{paths.e2eToPlatform}}/redis/open-redis.js';
{{/if}}
import { createCredentials, type TestActor } from './create-credentials.js';
{{#if broker.addressed}}
{{#if redis.server}}
import { noBroker, noRedis, testEnvironment } from './test-environment.js';
{{/if}}
{{#unless redis.server}}
import { noBroker, testEnvironment } from './test-environment.js';
{{/unless}}
{{/if}}
{{#unless broker.addressed}}
{{#if redis.server}}
import { noRedis, testEnvironment } from './test-environment.js';
{{/if}}
{{#unless redis.server}}
import { testEnvironment } from './test-environment.js';
{{/unless}}
{{/unless}}

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
  const config = loadConfig(testEnvironment({ DATABASE_URL: url ?? 'postgres://in-process/tests' }));
  const credentials = await createCredentials();
{{#if cache.redis}}
  const redis = config.redisUrl === noRedis ? undefined : openRedis(config);
  const application = composeApplication(database.persistence, { events: {{#if broker.provided}}eventsOf(config){{/if}}{{#unless broker.provided}}inProcessEvents(){{/unless}}, authenticator: credentials.authenticator, ...(redis === undefined ? {} : { redis }) });
{{/if}}
{{#unless cache.redis}}
  const application = composeApplication(database.persistence, { events: {{#if broker.provided}}eventsOf(config){{/if}}{{#unless broker.provided}}inProcessEvents(){{/unless}}, authenticator: credentials.authenticator });
{{/unless}}

  await application.start();

{{#if events.outbox}}
  const relay = startOutboxRelay({ store: database.persistence.outbox, publisher: application.eventBus, intervalMs: 20, logger: application.logger });
{{/if}}
  const server = await startHttpServer(application, config);
  const client = createHttpClient('http://127.0.0.1:' + server.port);

  return {
    client,
    events: application.eventSubscriber,
    as: async (actor) => client.withHeaders(await credentials.headersOf(actor)),
{{#if authz.rebac}}
    relate: (tuple) => relationTuples.write([tuple]),
{{/if}}
    reset: () => database.reset(),
    close: () => inOrder([() => server.close(), {{#if events.outbox}}() => relay.stop(), {{/if}}() => application.stop(), {{#if cache.redis}}() => redis?.close(), {{/if}}() => database.close()]),
  };
}
{{#if broker.provided}}

function eventsOf(config: AppConfig): EventProvider {
  return {{broker.inProcessWhen}} ? inProcessEvents() : createEventProvider(config);
}
{{/if}}

async function inOrder(steps: readonly (() => Promise<void> | undefined)[]): Promise<void> {
  for (const step of steps) await step();
}
