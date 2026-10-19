import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RelationTupleStore, type RelationTuple } from '@ddd-ts-kit/auth/rebac';
import { VarnishCachePurger } from '@ddd-ts-kit/http/purgers';
import {
  InMemoryCachePurger,
  PurgingPublisher,
  type CachePurger,
  type ErrorReporter,
  type IntegrationEventSubscriber,
} from '@ddd-ts-kit/kernel';
import {
  createHttpClient,
  settled,
  type HttpClient,
  type HttpHeaders,
  type SettledOptions,
} from '@ddd-ts-kit/testing/e2e';
import { type Client, createClient } from 'scheduling-api-client';
import { relateSystemActors } from '@/platform/auth/relationships/relate-system-actors';
import { composeApplication, type Application } from '@/platform/composition/compose-application';
import type { AppConfig } from '@/platform/config/app-config';
import { loadConfig } from '@/platform/config/load-config';
import type { Persistence } from '@/platform/database/persistence';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { createEventProvider } from '@/platform/events/create-event-provider';
import type { EventProvider } from '@/platform/events/event-provider';
import { inProcessEvents } from '@/platform/events/in-process-events';
import { openFiles } from '@/platform/files/open-files';
import { startOutboxRelay, type RunningRelay } from '@/platform/events/start-outbox-relay';
import type { LogSettings } from '@/platform/observability/create-logger';
import { startHttpServer, type HttpServer } from '@/platform/http/start-http-server';
import { openRedis, type RedisServices } from '@/platform/redis/open-redis';
import { createCredentials, type Credentials, type TestActor } from '$test/e2e/support/create-credentials';
import { noRedis, testEnvironment } from '$test/e2e/support/test-environment';

/** The whole application, real adapters included, as a client and another context see it. */
export interface RunningApplication {
  readonly client: HttpClient;
  /** The typed client of the contract (`clients/api`), as a consumer of the API calls it; it presents no credential. */
  readonly api: Client;
  /** Subscribe here (`collectEvents`) to assert the integration events the application publishes. */
  readonly events: IntegrationEventSubscriber;
  /** What the relay purged from the shared caches, once each command committed: `purges.purged` lists the tags. */
  readonly purges: InMemoryCachePurger;

  /** Where the server listens, `http://127.0.0.1:<port>`: for a request the JSON client does not send, a multipart upload. */
  readonly url: string;

  /** The directory of the local file storage, the one of development, made for this run and removed by `close`. */
  readonly filesDirectory: string;

  /** A client presenting the credential of `actor`; `client` itself presents none. */
  as(actor: TestActor): Promise<HttpClient>;

  /** The headers that carry the credential of `actor`, for a request sent with `fetch`. */
  headersOf(actor: TestActor): Promise<HttpHeaders>;
  /** The typed client presenting the credential of `actor`, given as the client is given it: a function asked before each request. */
  apiAs(actor: TestActor): Client;

  /**
   * Resolves once the work the requests so far started has settled: every event stored in the
   * outbox relayed, and the handlers it reached run, with what they stored in turn. Await it
   * before asserting what happens after the answer, instead of waiting a fixed time; it fails
   * after `timeoutMs` (2 seconds by default) naming what is still pending, and how much of it
   * failed and waits for a retry (a handler that throws, an adapter that cannot be reached).
   * With a Redis server (REDIS_URL), relayed means handed to the broker: what its consumers do
   * next is awaited with `collectEvents(application.events, [...]).waitFor(...)`. A background
   * job (`jobs: true`) is not counted: what it does is awaited on the resource that follows it.
   */
  settled(options?: SettledOptions): Promise<void>;

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
  /**
   * Listens on the port the VCL of docker/varnish names (`VARNISH_BACKEND_PORT`, 54300 by default)
   * and purges the Varnish of `VARNISH_URL` too, for a spec that reads the API through it. Only
   * one application at a time can listen there.
   */
  readonly behindVarnish?: boolean;
  /** Starts the scheduled jobs and the worker of the queues, as a process of `RUN_JOBS=true` does: where a spec waits for a background job. */
  readonly jobs?: boolean;
}

/**
 * Starts the application on a free port. The database is PostgreSQL in process unless
 * DATABASE_URL names a migrated server (`npm run infra:up && npm run db:migrate`). Files are
 * kept by the local storage of development, in a directory of its own.
 */
export async function startApplication(options: StartOptions = {}): Promise<RunningApplication> {
  // An empty variable (a blank line of .env) means the same as none.
  const url = process.env['DATABASE_URL'] === '' ? undefined : process.env['DATABASE_URL'];
  const database = await openTestDatabase(url);
  const { config, filesDirectory } = configuredFor(url, options);
  const credentials = await createCredentials();
  const redis = config.redisUrl === noRedis ? undefined : openRedis(config);
  const persistence = options.storage?.(database.persistence) ?? database.persistence;

  const application = composedOn(persistence, { config, credentials, redis }, options);

  await application.start();

  const purges = new InMemoryCachePurger();
  const relay = relayOf(persistence, application, purgerOf(purges, options, config));
  const server = await startHttpServer(application, config);
  const baseUrl = 'http://127.0.0.1:' + server.port;
  // The store of the running application: what a test relates is what its authorizer reads.
  const tuples = application.container.resolve(RelationTupleStore);

  return {
    ...callersOf(baseUrl, credentials),
    url: baseUrl,
    filesDirectory,
    events: application.eventSubscriber,
    purges,
    settled: (settling) => settled({ outbox: () => persistence.outbox.stats() }, settling),
    relate: (tuple) => tuples.write([tuple]),
    reset: () => relay.whileStopped(() => database.reset().then(() => relateSystemActors(tuples))),
    close: () => closeInOrder({ server, relay, application, redis, database, filesDirectory }),
  };
}

/** The application on the storage of the test, with the services of its run. */
function composedOn(
  persistence: Persistence,
  { config, credentials, redis }: { config: AppConfig; credentials: Credentials; redis: RedisServices | undefined },
  options: StartOptions,
): Application {
  return composeApplication(persistence, {
    events: eventsOf(config),
    authenticator: credentials.authenticator,
    networks: config.networks,
    ...observedOf(options),
    ...(redis === undefined ? {} : { redis }),
    files: openFiles(config.files),
  });
}

/** Who calls the running application: anonymously or as an actor, by raw HTTP or through the typed client of its contract. */
function callersOf(
  baseUrl: string,
  credentials: Credentials,
): Pick<RunningApplication, 'client' | 'api' | 'as' | 'headersOf' | 'apiAs'> {
  const client = createHttpClient(baseUrl);

  return {
    client,
    api: createClient({ baseUrl }),
    as: async (actor) => client.withHeaders(await credentials.headersOf(actor)),
    headersOf: (actor) => credentials.headersOf(actor),
    apiAs: (actor) => createClient({ baseUrl, credentials: { bearer: () => credentials.bearerOf(actor) } }),
  };
}

/** The configuration of a test run, its files in a directory of their own, on the port of the VCL behind Varnish. */
function configuredFor(
  url: string | undefined,
  options: StartOptions,
): { readonly config: AppConfig; readonly filesDirectory: string } {
  const filesDirectory = mkdtempSync(path.join(tmpdir(), 'scheduling-files-'));

  const environment = {
    DATABASE_URL: url ?? 'postgres://in-process/tests',
    FILES_DIRECTORY: filesDirectory,
    ...backendPortOf(options),
  };

  return { config: loadConfig(testEnvironment(environment)), filesDirectory };
}

function eventsOf(config: AppConfig): EventProvider {
  return config.redisUrl === noRedis ? inProcessEvents() : createEventProvider(config);
}

function observedOf(options: StartOptions): Pick<StartOptions, 'log' | 'errors'> & { jobs?: { start: boolean } } {
  return {
    ...(options.log === undefined ? {} : { log: options.log }),
    ...(options.errors === undefined ? {} : { errors: options.errors }),
    ...(options.jobs === true ? { jobs: { start: true } } : {}),
  };
}

/** The port of the VCL, when the spec reads the API through Varnish; a free one otherwise. */
function backendPortOf({ behindVarnish }: StartOptions): { PORT?: string } {
  return behindVarnish === true ? { PORT: process.env['VARNISH_BACKEND_PORT'] ?? '54300' } : {};
}

/** The purges are recorded for the spec, and sent to Varnish as well when it reads through one. */
function purgerOf(purges: InMemoryCachePurger, { behindVarnish }: StartOptions, config: AppConfig): CachePurger {
  const varnish =
    behindVarnish === true
      ? new VarnishCachePurger({ url: config.varnishUrl, key: config.varnishPurgeKey })
      : undefined;

  return {
    purge: async (tags) => {
      await varnish?.purge(tags);
      await purges.purge(tags);
    },
  };
}

function relayOf(persistence: Persistence, application: Application, purger: CachePurger): PausableRelay {
  return pausableRelay(() =>
    startOutboxRelay({
      store: persistence.outbox,
      publisher: new PurgingPublisher(purger, application.eventBus),
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
  readonly filesDirectory: string;
}

function closeInOrder({ server, relay, application, redis, database, filesDirectory }: Started): Promise<void> {
  return inOrder([
    () => server.close(),
    () => relay.stop(),
    () => application.stop(),
    () => redis?.close(),
    () => database.close(),
    () => {
      rmSync(filesDirectory, { recursive: true, force: true });

      return undefined;
    },
  ]);
}

async function inOrder(steps: readonly (() => Promise<void> | undefined)[]): Promise<void> {
  for (const step of steps) {
    await step();
  }
}
