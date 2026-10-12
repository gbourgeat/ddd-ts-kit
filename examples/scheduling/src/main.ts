// Imported first on purpose: instrumentation has to be installed before any module it patches is loaded.
import { tracing } from '@/platform/tracing';
// Imported second on purpose: a failure while the rest of the application loads is already reported.
import { errors } from '@/platform/errors';
import { createAuthenticator } from '@/platform/auth/create-authenticator';
import { composeApplication } from '@/platform/compose-application';
import { loadConfig } from '@/platform/config/load-config';
import { openPersistence } from '@/platform/database/open-persistence';
import { createEventProvider } from '@/platform/events/create-event-provider';
import { startCatchUp } from '@/platform/events/start-catch-up';
import { startOutboxRelay } from '@/platform/events/start-outbox-relay';
import { storeFedProjections } from '@/platform/events/store-fed-projections';
import { startHttpServer } from '@/platform/http/start-http-server';
import { jobSettings } from '@/platform/job-settings';
import { openRedis } from '@/platform/redis/open-redis';

const config = loadConfig(process.env);
const persistence = openPersistence(config);
const redis = openRedis(config);

const application = composeApplication(persistence, {
  events: createEventProvider(config, errors),
  errors,
  authenticator: createAuthenticator(config),
  log: { ...config.log, service: config.serviceName, environment: config.environment },
  traceConsumers: config.tracing.consumers,
  resilience: config.resilience,
  jobs: { start: config.runJobs, settings: jobSettings(process.env) },
  redis,
});

await application.start();

const relay = startOutboxRelay({
  store: persistence.outbox,
  publisher: application.eventBus,
  intervalMs: config.outboxRelayIntervalMs,
  logger: application.logger,
  errors,
  wakeOn: redis.relaySignal,
});

// The projections fed by the event store catch up in this process too, at the pace of the relay.
const catchUp = startCatchUp({
  subscriptions: storeFedProjections(application.container, persistence),
  intervalMs: config.outboxRelayIntervalMs,
  logger: application.logger,
});

const server = await startHttpServer(application, config);

application.logger.info('listening', { port: server.port });

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());

async function shutdown(): Promise<void> {
  await server.close();
  await relay.stop();
  await catchUp.stop();
  await application.stop();
  await redis.close();
  await persistence.close();
  await tracing.shutdown();
}
