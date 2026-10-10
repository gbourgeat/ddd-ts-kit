{{#if authz.rebac}}
import type { RelationTuple } from '@ddd-ts-kit/auth/rebac';
{{/if}}
import type { IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import { createHttpClient, type HttpClient } from '@ddd-ts-kit/testing/e2e';
{{#if authz.rebac}}
import { relationTuples } from '{{alias.platform}}/auth/relation-tuples.js';
{{/if}}
import { composeApplication } from '{{alias.platform}}/compose-application.js';
import type { AppConfig } from '{{alias.platform}}/config/app-config.js';
import { loadConfig } from '{{alias.platform}}/config/load-config.js';
import { openTestDatabase, type TestDatabase } from '{{alias.platform}}/database/open-test-database.js';
{{#if broker.provided}}
import { createEventProvider } from '{{alias.platform}}/events/create-event-provider.js';
import type { EventProvider } from '{{alias.platform}}/events/event-provider.js';
{{/if}}
import { inProcessEvents } from '{{alias.platform}}/events/in-process-events.js';
{{#if events.outbox}}
import { startOutboxRelay } from '{{alias.platform}}/events/start-outbox-relay.js';
{{/if}}
import { startHttpServer } from '{{alias.platform}}/http/start-http-server.js';
{{#if cache.redis}}
import { openRedis } from '{{alias.platform}}/redis/open-redis.js';
{{/if}}
import { createCredentials, type Credentials, type TestActor } from '{{alias.test}}/e2e/support/create-credentials.js';
{{#if broker.addressed}}
{{#if redis.server}}
import { noBroker, noRedis, testEnvironment } from '{{alias.test}}/e2e/support/test-environment.js';
{{/if}}
{{#unless redis.server}}
import { noBroker, testEnvironment } from '{{alias.test}}/e2e/support/test-environment.js';
{{/unless}}
{{/if}}
{{#unless broker.addressed}}
{{#if redis.server}}
import { noRedis, testEnvironment } from '{{alias.test}}/e2e/support/test-environment.js';
{{/if}}
{{#unless redis.server}}
import { testEnvironment } from '{{alias.test}}/e2e/support/test-environment.js';
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
  const started = await start(database, config, credentials);

  return {
    client: started.client,
    events: started.events,
    as: async (actor) => started.client.withHeaders(await credentials.headersOf(actor)),
{{#if authz.rebac}}
    relate: (tuple) => relationTuples.write([tuple]),
{{/if}}
    reset: () => database.reset(),
    close: () => started.close(),
  };
}

interface Started {
  readonly client: HttpClient;
  readonly events: IntegrationEventSubscriber;

  close(): Promise<void>;
}

/** The application on the test database, listening on a free port; closing it closes the database last. */
async function start(database: TestDatabase, config: AppConfig, credentials: Credentials): Promise<Started> {
{{#if cache.redis}}
  const redis = config.redisUrl === noRedis ? undefined : openRedis(config);

{{/if}}
  const application = composeApplication(database.persistence, {
    events: {{#if broker.provided}}eventsOf(config){{/if}}{{#unless broker.provided}}inProcessEvents(){{/unless}},
    authenticator: credentials.authenticator,
{{#if cache.redis}}
    ...(redis === undefined ? {} : { redis }),
{{/if}}
  });

  await application.start();

{{#if events.outbox}}
  const relay = startOutboxRelay({
    store: database.persistence.outbox,
    publisher: application.eventBus,
    intervalMs: 20,
    logger: application.logger,
  });

{{/if}}
  const server = await startHttpServer(application, config);

  return {
    client: createHttpClient('http://127.0.0.1:' + server.port),
    events: application.eventSubscriber,
    close: async () => {
      await server.close();
{{#if events.outbox}}
      await relay.stop();
{{/if}}
      await application.stop();
{{#if cache.redis}}
      await redis?.close();
{{/if}}
      await database.close();
    },
  };
}
{{#if broker.provided}}

function eventsOf(config: AppConfig): EventProvider {
  return {{broker.inProcessWhen}} ? inProcessEvents() : createEventProvider(config);
}
{{/if}}
