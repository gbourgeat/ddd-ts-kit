import { createHttpClient, type HttpClient } from '@ddd-ts-kit/testing/e2e';
import type { IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import { composeApplication } from '{{paths.e2eToPlatform}}/application.js';
import { loadConfig } from '{{paths.e2eToPlatform}}/config.js';
import { openTestDatabase } from '{{paths.e2eToPlatform}}/database/testing.js';
import { startHttpServer } from '{{paths.e2eToPlatform}}/http-server.js';
{{#if events.outbox}}
import { startOutboxRelay } from '{{paths.e2eToPlatform}}/outbox-relay.js';
{{/if}}

/** The whole application, real adapters included, as a client and another context see it. */
export interface RunningApplication {
  readonly client: HttpClient;
  /** Subscribe here (`collectEvents`) to assert the integration events the application publishes. */
  readonly events: IntegrationEventSubscriber;
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
  const config = loadConfig({ ...process.env, NODE_ENV: 'test', PORT: '0', DATABASE_URL: url ?? 'postgres://in-process/tests' });
  const application = composeApplication(database.persistence);
  await application.start();
{{#if events.outbox}}
  const relay = startOutboxRelay({ store: database.persistence.outbox, publisher: application.eventBus, intervalMs: 20 });
{{/if}}
  const server = await startHttpServer(application.routes, config);
  return {
    client: createHttpClient('http://127.0.0.1:' + server.port),
    events: application.eventSubscriber,
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
