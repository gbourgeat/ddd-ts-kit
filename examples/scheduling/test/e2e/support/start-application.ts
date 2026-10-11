import { RelationTupleStore, type RelationTuple } from '@ddd-ts-kit/auth/rebac';
import type { ErrorReporter, IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import { createHttpClient, type HttpClient } from '@ddd-ts-kit/testing/e2e';
import { relateSystemActors } from '@/platform/auth/relate-system-actors';
import { composeApplication, type Application } from '@/platform/compose-application';
import type { AppConfig } from '@/platform/config/app-config';
import { loadConfig } from '@/platform/config/load-config';
import type { Persistence } from '@/platform/database/persistence';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { createEventProvider } from '@/platform/events/create-event-provider';
import type { EventProvider } from '@/platform/events/event-provider';
import { inProcessEvents } from '@/platform/events/in-process-events';
import { startOutboxRelay, type RunningRelay } from '@/platform/events/start-outbox-relay';
import type { LogSettings } from '@/platform/observability/create-logger';
import { startHttpServer, type HttpServer } from '@/platform/http/start-http-server';
import { openRedis, type RedisServices } from '@/platform/redis/open-redis';
import { createCredentials, type TestActor } from '$test/e2e/support/create-credentials';
import { noRedis, testEnvironment } from '$test/e2e/support/test-environment';

/** The whole application, real adapters included, as a client and another context see it. */
export interface RunningApplication {
  readonly client: HttpClient;
  /** Subscribe here (`collectEvents`) to assert the integration events the application publishes. */
  readonly events: IntegrationEventSubscriber;

  /** A client presenting the credential of `actor`; `client` itself presents none. */
  as(actor: TestActor): Promise<HttpClient>;

  /** Stores a relationship, as the application does when an element is created or shared. */
  relate(tuple: RelationTuple): Promise<void>;

  /** Empties the database, then stores the relationships of the system actors again: call it before each test. */
  reset(): Promise<void>;

  close(): Promise<void>;
}

/** What a spec about the application observed from outside gives it; left out, it logs and reports nowhere, on a storage that answers. */
export interface StartOptions {
  /** Where the application logs: a destination the spec reads. */
  readonly log?: LogSettings;
  /** Where unexpected failures are reported: a reporter the spec reads. */
  readonly errors?: ErrorReporter;
  /** Put around the storage before the application is composed on it: where a spec makes the infrastructure fail. */
  readonly storage?: (persistence: Persistence) => Persistence;
}

/**
 * Starts the application on a free port. The database is PostgreSQL in process unless
 * DATABASE_URL names a migrated server (`npm run infra:up && npm run db:migrate`).
 */
export async function startApplication(options: StartOptions = {}): Promise<RunningApplication> {
  // An empty variable (a blank line of .env) means the same as none.
  const url = process.env['DATABASE_URL'] === '' ? undefined : process.env['DATABASE_URL'];
  const database = await openTestDatabase(url);
  const config = loadConfig(testEnvironment({ DATABASE_URL: url ?? 'postgres://in-process/tests' }));
  const credentials = await createCredentials();
  const redis = config.redisUrl === noRedis ? undefined : openRedis(config);
  const persistence = options.storage?.(database.persistence) ?? database.persistence;

  const application = composeApplication(persistence, {
    events: eventsOf(config),
    authenticator: credentials.authenticator,
    ...observedOf(options),
    ...(redis === undefined ? {} : { redis }),
  });

  await application.start();

  const relay = relayOf(persistence, application);
  const server = await startHttpServer(application, config);
  const client = createHttpClient('http://127.0.0.1:' + server.port);
  // The store of the running application: what a test relates is what its authorizer reads.
  const tuples = application.container.resolve(RelationTupleStore);

  return {
    client,
    events: application.eventSubscriber,
    as: async (actor) => client.withHeaders(await credentials.headersOf(actor)),
    relate: (tuple) => tuples.write([tuple]),
    reset: () => relay.whileStopped(() => database.reset().then(() => relateSystemActors(tuples))),
    close: () => closeInOrder({ server, relay, application, redis, database }),
  };
}

function eventsOf(config: AppConfig): EventProvider {
  return config.redisUrl === noRedis ? inProcessEvents() : createEventProvider(config);
}

function observedOf(options: StartOptions): Pick<StartOptions, 'log' | 'errors'> {
  return {
    ...(options.log === undefined ? {} : { log: options.log }),
    ...(options.errors === undefined ? {} : { errors: options.errors }),
  };
}

function relayOf(persistence: Persistence, application: Application): PausableRelay {
  return pausableRelay(() =>
    startOutboxRelay({
      store: persistence.outbox,
      publisher: application.eventBus,
      intervalMs: 20,
      logger: application.logger,
    }),
  );
}

interface PausableRelay extends RunningRelay {
  whileStopped(work: () => Promise<void>): Promise<void>;
}

/**
 * A relay that has read the events of one test must have delivered them before the next test
 * starts listening: stopping waits for the delivery in flight, which emptying the database does not.
 */
function pausableRelay(start: () => RunningRelay): PausableRelay {
  let running = start();

  return {
    stop: () => running.stop(),
    whileStopped: async (work) => {
      await running.stop();
      await work();
      running = start();
    },
  };
}

interface Started {
  readonly server: HttpServer;
  readonly relay: RunningRelay;
  readonly application: Application;
  readonly redis: RedisServices | undefined;
  readonly database: TestDatabase;
}

function closeInOrder({ server, relay, application, redis, database }: Started): Promise<void> {
  return inOrder([
    () => server.close(),
    () => relay.stop(),
    () => application.stop(),
    () => redis?.close(),
    () => database.close(),
  ]);
}

async function inOrder(steps: readonly (() => Promise<void> | undefined)[]): Promise<void> {
  for (const step of steps) {
    await step();
  }
}
