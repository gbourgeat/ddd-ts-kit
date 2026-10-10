// Imported first on purpose: instrumentation has to be installed before any module it patches is loaded.
import { tracing } from '#src/platform/tracing.js';
// Imported second on purpose: a failure while the rest of the application loads is already reported.
import { errors } from '#src/platform/errors.js';
import { createAuthenticator } from '#src/platform/auth/create-authenticator.js';
import { composeApplication } from '#src/platform/compose-application.js';
import { loadConfig } from '#src/platform/config/load-config.js';
import { openPersistence } from '#src/platform/database/open-persistence.js';
import { createEventProvider } from '#src/platform/events/create-event-provider.js';
import { startOutboxRelay } from '#src/platform/events/start-outbox-relay.js';
import { startHttpServer } from '#src/platform/http/start-http-server.js';
import { jobSettings } from '#src/platform/job-settings.js';
import { openRedis } from '#src/platform/redis/open-redis.js';

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

const server = await startHttpServer(application, config);

application.logger.info('listening', { port: server.port });

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());

async function shutdown(): Promise<void> {
  await server.close();
  await relay.stop();
  await application.stop();
  await redis.close();
  await persistence.close();
  await tracing.shutdown();
}
