{{#if authz.rebac}}
import type { RelationTuple } from '@ddd-ts-kit/auth/rebac';
{{/if}}
{{#if httpCache.varnish}}
import {
  InMemoryCachePurger,
  PurgingPublisher,
  type IntegrationEvent,
  type IntegrationEventSubscriber,
} from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless httpCache.varnish}}
import type { IntegrationEvent, IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
{{/unless}}
{{#if style.declared}}
import { defineContextModule } from '@ddd-ts-kit/di';
{{/if}}
import { createHttpClient, settled, type HttpClient, type SettledOptions } from '@ddd-ts-kit/testing/e2e';
{{#if authz.rebac}}
import { relateSystemActors } from '{{alias.platform}}/auth/relationships/relate-system-actors{{alias.ext}}';
import { relationTuples } from '{{alias.platform}}/auth/relationships/relation-tuples{{alias.ext}}';
{{/if}}
{{#if style.declared}}
import { composeApplication, everyContext } from '{{alias.platform}}/composition/compose-application{{alias.ext}}';
import type { ContextSelection } from '{{alias.platform}}/composition/context-selection{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import { composeApplication, everyContext } from '{{alias.platform}}/composition/compose-application{{alias.ext}}';
{{/unless}}
import type { AppConfig } from '{{alias.platform}}/config/app-config{{alias.ext}}';
import { loadConfig } from '{{alias.platform}}/config/load-config{{alias.ext}}';
import { openTestDatabase, type TestDatabase } from '{{alias.platform}}/database/open-test-database{{alias.ext}}';
{{#if broker.provided}}
import { createEventProvider } from '{{alias.platform}}/events/create-event-provider{{alias.ext}}';
import type { EventProvider } from '{{alias.platform}}/events/event-provider{{alias.ext}}';
{{/if}}
import { inProcessEvents } from '{{alias.platform}}/events/in-process-events{{alias.ext}}';
{{#if events.outbox}}
import { startOutboxRelay } from '{{alias.platform}}/events/start-outbox-relay{{alias.ext}}';
{{/if}}
import { startHttpServer } from '{{alias.platform}}/http/start-http-server{{alias.ext}}';
{{#if cache.redis}}
import { openRedis } from '{{alias.platform}}/redis/open-redis{{alias.ext}}';
{{/if}}
import { createCredentials, type Credentials, type TestActor } from '{{alias.test}}/e2e/support/create-credentials{{alias.ext}}';
{{#if broker.addressed}}
{{#if redis.server}}
import { noBroker, noRedis, testEnvironment } from '{{alias.test}}/e2e/support/test-environment{{alias.ext}}';
{{/if}}
{{#unless redis.server}}
import { noBroker, testEnvironment } from '{{alias.test}}/e2e/support/test-environment{{alias.ext}}';
{{/unless}}
{{/if}}
{{#unless broker.addressed}}
{{#if redis.server}}
import { noRedis, testEnvironment } from '{{alias.test}}/e2e/support/test-environment{{alias.ext}}';
{{/if}}
{{#unless redis.server}}
import { testEnvironment } from '{{alias.test}}/e2e/support/test-environment{{alias.ext}}';
{{/unless}}
{{/unless}}

// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/** The whole application, real adapters included, as a client and another context see it. */
export interface RunningApplication {
  readonly client: HttpClient;
  /** Subscribe here (`collectEvents`) to assert the integration events the application publishes. */
  readonly events: IntegrationEventSubscriber;
{{#if httpCache.varnish}}
  /** What the relay purged from the shared cache once each command committed: `purges.purged` lists the tags. */
  readonly purges: InMemoryCachePurger;
{{/if}}

  /** A client presenting the credential of `actor`; `client` itself presents none. */
  as(actor: TestActor): Promise<HttpClient>;

  /**
   * Publishes integration events of an upstream as its relay would, to the handlers of the
   * application: what starts a use case no route reaches. Await `settled()` next, before asserting
   * what the handlers did.
{{#if broker.provided}}
   * With a broker server (its URL in the environment), the events go to the broker: what its
   * consumers do is awaited with `collectEvents(application.events, [...]).waitFor(...)`.
{{/if}}
   */
  publish(events: readonly IntegrationEvent[]): Promise<void>;

  /**
{{#if events.outbox}}
   * Resolves once the work the requests so far started has settled: every event stored in the
   * outbox relayed, and the handlers it reached run, with what they stored in turn. Await it
   * before asserting what happens after the answer, instead of waiting a fixed time; it fails
   * after `timeoutMs` (2 seconds by default) naming what is still pending, and how much of it
   * failed and waits for a retry (a handler that throws, an adapter that cannot be reached).
{{#if broker.provided}}
   * With a broker server (its URL in the environment), relayed means handed to the broker: what
   * its consumers do next is awaited with `collectEvents(application.events, [...]).waitFor(...)`.
{{/if}}
{{/if}}
{{#unless events.outbox}}
   * Resolves once the work the requests so far started has settled. Without an outbox, events go
   * out with the commit and their handlers are awaited before the answer: nothing is left then.
{{/unless}}
   */
  settled(options?: SettledOptions): Promise<void>;
{{#if authz.rebac}}

  /** Stores a relationship, as the application does when an element is created or shared. */
  relate(tuple: RelationTuple): Promise<void>;
{{/if}}

{{#if authz.rebac}}
  /**
   * Empties the database and writes the relationships of the system actors again, the state right
   * after start: call it before each test.
   */
{{/if}}
{{#unless authz.rebac}}
  /** Empties the database: call it before each test. */
{{/unless}}
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
{{#if httpCache.varnish}}
    purges: started.purges,
{{/if}}
    as: async (actor) => started.client.withHeaders(await credentials.headersOf(actor)),
    publish: (events) => started.publish(events),
{{#if authz.rebac}}
    relate: (tuple) => relationTuples.write([tuple]),
{{/if}}
    settled: (options) => started.settled(options),
{{#if authz.rebac}}
    reset: async () => {
      await database.reset();
      await relateSystemActors();
    },
{{/if}}
{{#unless authz.rebac}}
    reset: () => database.reset(),
{{/unless}}
    close: () => started.close(),
  };
}

interface Started {
  readonly client: HttpClient;
  readonly events: IntegrationEventSubscriber;
{{#if httpCache.varnish}}
  readonly purges: InMemoryCachePurger;
{{/if}}

  publish(events: readonly IntegrationEvent[]): Promise<void>;

  settled(options?: SettledOptions): Promise<void>;

  close(): Promise<void>;
}

/** The application on the test database, listening on a free port; closing it closes the database last. */
async function start(database: TestDatabase, config: AppConfig, credentials: Credentials): Promise<Started> {
{{#if cache.redis}}
  const redis = config.redisUrl === noRedis ? undefined : openRedis(config);

{{/if}}
  const application = composeApplication(
    database.persistence,
    {
      events: {{#if broker.provided}}eventsOf(config){{/if}}{{#unless broker.provided}}inProcessEvents(){{/unless}},
      authenticator: credentials.authenticator,
{{#if cache.redis}}
      ...(redis === undefined ? {} : { redis }),
{{/if}}
    },
    contextsOfTheRun(),
  );

  await application.start();

{{#if httpCache.varnish}}
  const purges = new InMemoryCachePurger();

{{/if}}
{{#if events.outbox}}
  const relay = startOutboxRelay({
    store: database.persistence.outbox,
{{#if httpCache.varnish}}
    // The purge requests of the commands are recorded instead of sent to Varnish, every other event goes to the bus.
    publisher: new PurgingPublisher(purges, application.eventBus),
{{/if}}
{{#unless httpCache.varnish}}
    publisher: application.eventBus,
{{/unless}}
    intervalMs: 20,
    logger: application.logger,
  });

{{/if}}
  const server = await startHttpServer(application, config);

  return {
    client: createHttpClient('http://127.0.0.1:' + server.port),
    events: application.eventSubscriber,
{{#if httpCache.varnish}}
    purges,
{{/if}}
    publish: (events) => application.eventBus.publish(events),
{{#if events.outbox}}
    settled: (options) => settled({ outbox: () => database.persistence.outbox.stats() }, options),
{{/if}}
{{#unless events.outbox}}
    // Without an outbox nothing runs after the answer: the events went out with the commit.
    settled: (options) => settled({}, options),
{{/unless}}
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

/**
 * The contexts as a test run composes them. An outside system that answers nowhere in a test run
 * (an identity provider, a payment service) is answered by its fake of `test/fakes/` here, where
 * the preset or the person who adds it binds it, so that its handlers settle instead of retrying.
 */
{{#if style.declared}}
function contextsOfTheRun(): ContextSelection {
  const fakes = defineContextModule({
    name: 'end-to-end-fakes',
    register(builder) {
      // ddd-ts-kit:e2e-fakes
      // /ddd-ts-kit:e2e-fakes
    },
  });

  return { ...everyContext, modules: [...everyContext.modules, fakes] };
}
{{/if}}
{{#unless style.declared}}
function contextsOfTheRun(): typeof everyContext {
  return everyContext.map((module): (typeof everyContext)[number] => {
    // ddd-ts-kit:e2e-fakes
    // /ddd-ts-kit:e2e-fakes

    return module;
  });
}
{{/unless}}
