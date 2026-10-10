{{#if authz.rebac}}
import type { RelationTuple } from '@ddd-ts-kit/auth/rebac';
{{/if}}
import type { IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import { createHttpClient, type HttpClient } from '@ddd-ts-kit/testing/e2e';
{{#if authz.rebac}}
import { relationTuples } from '{{alias.platform}}/auth/relation-tuples.js';
{{/if}}
import { composeApplication } from '{{alias.platform}}/compose-application.js';
{{#if broker.provided}}
import type { AppConfig } from '{{alias.platform}}/config/app-config.js';
{{/if}}
import { loadConfig } from '{{alias.platform}}/config/load-config.js';
import { openPersistence } from '{{alias.platform}}/database/open-persistence.js';
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

/** The whole application as a client and another context see it. */
export interface RunningApplication {
  /** Read it again after `reset`: the application was started anew. */
  readonly client: HttpClient;
  /** Subscribe here (`collectEvents`) to assert the integration events the application publishes. */
  readonly events: IntegrationEventSubscriber;

  /** A client presenting the credential of `actor`; `client` itself presents none. */
  as(actor: TestActor): Promise<HttpClient>;
{{#if authz.rebac}}

  /** Stores a relationship, as the application does when an element is created or shared. */
  relate(tuple: RelationTuple): Promise<void>;
{{/if}}

  /** Starts from nothing again: call it before each test. */
  reset(): Promise<void>;

  close(): Promise<void>;
}

/** State lives in memory, so a clean state is a new application on a new free port. */
export async function startApplication(): Promise<RunningApplication> {
  const credentials = await createCredentials();
  let current = await start(credentials);

  return {
    get client() {
      return current.client;
    },
    get events() {
      return current.events;
    },
    as: async (actor) => current.client.withHeaders(await credentials.headersOf(actor)),
{{#if authz.rebac}}
    relate: (tuple) => relationTuples.write([tuple]),
{{/if}}
    reset: async () => {
      await current.close();
      current = await start(credentials);
    },
    close: () => current.close(),
  };
}

interface Started {
  readonly client: HttpClient;
  readonly events: IntegrationEventSubscriber;

  close(): Promise<void>;
}

async function start(credentials: Credentials): Promise<Started> {
  const persistence = openPersistence();
  const config = loadConfig(testEnvironment());
{{#if cache.redis}}
  const redis = config.redisUrl === noRedis ? undefined : openRedis(config);
{{/if}}

  const application = composeApplication(persistence, {
    events: {{#if broker.provided}}eventsOf(config){{/if}}{{#unless broker.provided}}inProcessEvents(){{/unless}},
    authenticator: credentials.authenticator,
{{#if cache.redis}}
    ...(redis === undefined ? {} : { redis }),
{{/if}}
  });

  await application.start();

{{#if events.outbox}}
  const relay = startOutboxRelay({
    store: persistence.outbox,
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
      await persistence.close();
    },
  };
}
{{#if broker.provided}}

function eventsOf(config: AppConfig): EventProvider {
  return {{broker.inProcessWhen}} ? inProcessEvents() : createEventProvider(config);
}
{{/if}}
