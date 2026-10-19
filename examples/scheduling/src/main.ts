// Imported first on purpose: instrumentation has to be installed before any module it patches is loaded.
import { tracing } from '@/platform/tracing';
// Imported second on purpose: a failure while the rest of the application loads is already reported.
import { errors } from '@/platform/errors';
import { VarnishCachePurger } from '@ddd-ts-kit/http/purgers';
import { PersonalDataCipher, PurgingPublisher, RepeatedCachePurger } from '@ddd-ts-kit/kernel';
import { createAuthenticator } from '@/platform/auth/authentication/create-authenticator';
import { composeApplication } from '@/platform/compose-application';
import { loadConfig } from '@/platform/config/load-config';
import { openPersistence } from '@/platform/database/open-persistence';
import { createEventProvider } from '@/platform/events/create-event-provider';
import { startCatchUp } from '@/platform/events/start-catch-up';
import { startOutboxRelay } from '@/platform/events/start-outbox-relay';
import { openFiles } from '@/platform/files/open-files';
import { storeFedProjections } from '@/platform/events/store-fed-projections';
import { startHttpServer } from '@/platform/http/start-http-server';
import { jobSettings } from '@/platform/job-settings';
import { openRedis } from '@/platform/redis/open-redis';

// Longer than the slowest read of the API: a read on its way when the first purge ran is purged by the second.
const PURGE_AGAIN_AFTER_MS = 2_000;

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
  networks: config.networks,
  jobs: { start: config.runJobs, settings: jobSettings(process.env) },
  redis,
  files: openFiles(config.files),
});

await application.start();

const relay = startOutboxRelay({
  store: persistence.outbox,
  // The purge requests the use cases wrote with their commands go to Varnish, every other event to the provider.
  // Purged again two seconds later: a read that loaded the hours before the commit may reach Varnish after the purge.
  publisher: new PurgingPublisher(
    new RepeatedCachePurger(new VarnishCachePurger({ url: config.varnishUrl, key: config.varnishPurgeKey }), {
      againAfterMs: PURGE_AGAIN_AFTER_MS,
      onFailure: (_error, tags) => application.logger.warn('second purge failed', { tags: tags.join(' ') }),
    }),
    application.eventBus,
  ),
  intervalMs: config.outboxRelayIntervalMs,
  logger: application.logger,
  errors,
  wakeOn: redis.relaySignal,
});

// The projections fed by the event store catch up in this process too, at the pace of the relay:
// with several replicas, the checkpoint lets one of them apply each batch (README, Event sourcing).
const catchUp = startCatchUp({
  subscriptions: storeFedProjections(persistence, application.container.resolve(PersonalDataCipher)).map(
    ({ subscription }) => subscription,
  ),
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
