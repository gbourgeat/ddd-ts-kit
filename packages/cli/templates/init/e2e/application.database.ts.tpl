import { createHttpClient, type HttpClient } from '@ddd-ts-kit/testing/e2e';
{{#if authz.rebac}}
import type { RelationTuple } from '@ddd-ts-kit/auth/rebac';
{{/if}}
import type { IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import { composeApplication } from '{{paths.e2eToPlatform}}/application.js';
{{#if authz.rebac}}
import { relationTuples } from '{{paths.e2eToPlatform}}/auth/relationships.js';
{{/if}}
{{#if cache.redis}}
import { openRedis } from '{{paths.e2eToPlatform}}/cache.js';
{{/if}}
import { loadConfig } from '{{paths.e2eToPlatform}}/config.js';
import { openTestDatabase } from '{{paths.e2eToPlatform}}/database/testing.js';
{{#if broker.provided}}
import { createEventProvider, inProcessEvents } from '{{paths.e2eToPlatform}}/events.js';
{{/if}}
{{#unless broker.provided}}
import { inProcessEvents } from '{{paths.e2eToPlatform}}/events.js';
{{/unless}}
import { startHttpServer } from '{{paths.e2eToPlatform}}/http-server.js';
{{#if events.outbox}}
import { startOutboxRelay } from '{{paths.e2eToPlatform}}/outbox-relay.js';
{{/if}}
import { AUTH_ENVIRONMENT, createCredentials, type TestActor } from './credentials.js';
{{#if broker.addressed}}

/** Without {{broker.variable}} (`npm run infra:up` gives one) the events stay in the process: the same ports, no broker. */
const NO_BROKER = '{{broker.absent}}';
{{/if}}

{{#if cache.redis}}

/** Without REDIS_URL (`npm run infra:up` gives one) the cache and the limiter stay in the memory of the process: the same ports, no server. */
const NO_REDIS = 'redis://in-process/tests';
{{/if}}
{{#unless cache.redis}}
{{#if redis.streams}}

/** Without REDIS_URL (`npm run infra:up` gives one) the events stay in the process: the same ports, no server. */
const NO_REDIS = 'redis://in-process/tests';
{{/if}}
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
  const config = loadConfig({ ...process.env, ...AUTH_ENVIRONMENT, NODE_ENV: 'test', PORT: '0'{{#if broker.addressed}}, {{broker.variable}}: brokerUrl(){{/if}}{{#if redis.server}}, REDIS_URL: redisUrl(){{/if}}{{#if cache.rateLimit}}, RATE_LIMIT_MAX: process.env['RATE_LIMIT_MAX'] ?? '1000000'{{/if}}, DATABASE_URL: url ?? 'postgres://in-process/tests' });
  const credentials = await createCredentials();
{{#if cache.redis}}
  const redis = config.redisUrl === NO_REDIS ? undefined : openRedis(config);
{{/if}}
  const application = composeApplication(database.persistence, { events: {{#if broker.provided}}{{broker.inProcessWhen}} ? inProcessEvents() : createEventProvider(config){{/if}}{{#unless broker.provided}}inProcessEvents(){{/unless}}, authenticator: credentials.authenticator{{#if cache.redis}}, ...(redis === undefined ? {} : { redis }){{/if}} });
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
{{#if broker.addressed}}

function brokerUrl(): string {
  return (process.env['{{broker.variable}}'] ?? '') || NO_BROKER;
}
{{/if}}
{{#if redis.server}}

function redisUrl(): string {
  return (process.env['REDIS_URL'] ?? '') || NO_REDIS;
}
{{/if}}
