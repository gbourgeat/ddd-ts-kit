// Imported first on purpose: instrumentation has to be installed before any module it patches is loaded.
import { tracing } from './platform/tracing.js';
{{#if errors.sentry}}
// Imported second on purpose: a failure while the rest of the application loads is already reported.
import { errors } from './platform/errors.js';
{{/if}}
{{#if http.any}}
import { createAuthenticator } from './platform/auth/create-authenticator.js';
{{/if}}
import { composeApplication } from './platform/compose-application.js';
import { loadConfig } from './platform/config/load-config.js';
import { openPersistence } from './platform/database/open-persistence.js';
import { {{events.providerName}} } from './platform/events/{{events.providerFile}}.js';
{{#if events.outbox}}
import { startOutboxRelay } from './platform/events/start-outbox-relay.js';
{{/if}}
{{#if http.any}}
import { startHttpServer } from './platform/http/start-http-server.js';
{{/if}}
import { jobSettings } from './platform/job-settings.js';
{{#if cache.redis}}
import { openRedis } from './platform/redis/open-redis.js';
{{/if}}

const config = loadConfig(process.env);
{{#if persistence.needsUrl}}
const persistence = {{persistence.await}}openPersistence(config);
{{/if}}
{{#unless persistence.needsUrl}}
const persistence = openPersistence();
{{/unless}}
{{#if cache.redis}}
const redis = openRedis(config);
{{/if}}

const application = composeApplication(persistence, {
  events: {{events.provider}},
  {{#if errors.sentry}}
  errors,
  {{/if}}
  {{#if http.any}}
  authenticator: createAuthenticator(config),
  {{/if}}
  log: { ...config.log, service: config.serviceName, environment: config.environment },
  traceConsumers: config.tracing.consumers,
  resilience: config.resilience,
  jobs: { start: config.runJobs, settings: jobSettings(process.env) },
  {{#if cache.redis}}
  redis,
  {{/if}}
});

await application.start();

{{#if events.outbox}}
const relay = startOutboxRelay({
  store: persistence.outbox,
  publisher: application.eventBus,
  intervalMs: config.outboxRelayIntervalMs,
  logger: application.logger,
  {{#if errors.sentry}}
  errors,
  {{/if}}
  {{#if cache.relaySignal}}
  wakeOn: redis.relaySignal,
  {{/if}}
  {{#if persistence.signals}}
  wakeOn: persistence.relaySignal,
  {{/if}}
});

{{/if}}
{{#if http.any}}
const server = await startHttpServer(application, config);

application.logger.info('listening', { port: server.port });
{{/if}}
{{#unless http.any}}
application.logger.info('started');
{{/unless}}

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());

async function shutdown(): Promise<void> {
  {{#if http.any}}
  await server.close();
  {{/if}}
  {{#if events.outbox}}
  await relay.stop();
  {{/if}}
  await application.stop();
  {{#if cache.redis}}
  await redis.close();
  {{/if}}
  await persistence.close();
  await tracing.shutdown();
}
