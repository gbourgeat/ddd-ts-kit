import { createHttpClient, type HttpClient } from '@ddd-ts-kit/testing/e2e';
import type { IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import { composeApplication } from '{{paths.e2eToPlatform}}/application.js';
import { loadConfig } from '{{paths.e2eToPlatform}}/config.js';
import { openPersistence } from '{{paths.e2eToPlatform}}/database/persistence.js';
import { startHttpServer } from '{{paths.e2eToPlatform}}/http-server.js';
{{#if events.outbox}}
import { startOutboxRelay } from '{{paths.e2eToPlatform}}/outbox-relay.js';
{{/if}}

/** The whole application as a client and another context see it. */
export interface RunningApplication {
  /** Read it again after `reset`: the application was started anew. */
  readonly client: HttpClient;
  /** Subscribe here (`collectEvents`) to assert the integration events the application publishes. */
  readonly events: IntegrationEventSubscriber;
  /** Starts from nothing again: call it before each test. */
  reset(): Promise<void>;
  close(): Promise<void>;
}

/** State lives in memory, so a clean state is a new application on a new free port. */
export async function startApplication(): Promise<RunningApplication> {
  let current = await start();
  return {
    get client() {
      return current.client;
    },
    get events() {
      return current.events;
    },
    reset: async () => {
      await current.close();
      current = await start();
    },
    close: () => current.close(),
  };
}

interface Started {
  readonly client: HttpClient;
  readonly events: IntegrationEventSubscriber;
  close(): Promise<void>;
}

async function start(): Promise<Started> {
  const persistence = openPersistence();
  const application = composeApplication(persistence);
  await application.start();
{{#if events.outbox}}
  const relay = startOutboxRelay({ store: persistence.outbox, publisher: application.eventBus, intervalMs: 20 });
{{/if}}
  const server = await startHttpServer(application.routes, loadConfig({ ...process.env, NODE_ENV: 'test', PORT: '0' }));
  return {
    client: createHttpClient('http://127.0.0.1:' + server.port),
    events: application.eventSubscriber,
    close: async () => {
      await server.close();
{{#if events.outbox}}
      await relay.stop();
{{/if}}
      await application.stop();
      await persistence.close();
    },
  };
}
