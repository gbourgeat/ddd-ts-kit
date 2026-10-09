// Imported first on purpose: instrumentation has to be installed before any module it patches is loaded.
import { tracing } from './platform/tracing.js';
import { composeApplication } from './platform/application.js';
{{#if http.any}}
import { createAuthenticator } from './platform/auth/authenticator.js';
{{/if}}
{{#if cache.redis}}
import { openRedis } from './platform/cache.js';
{{/if}}
import { loadConfig } from './platform/config.js';
import { {{events.providerName}} } from './platform/events.js';
import { openPersistence } from './platform/database/persistence.js';
{{#if http.any}}
import { startHttpServer } from './platform/http-server.js';
{{/if}}
{{#if events.outbox}}
import { startOutboxRelay } from './platform/outbox-relay.js';
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
{{#if http.any}}
  authenticator: createAuthenticator(config),
{{/if}}
  log: { level: config.logLevel, service: config.serviceName },
  resilience: config.resilience,
{{#if cache.redis}}
  redis,
{{/if}}
});
await application.start();
{{#if events.outbox}}
{{#if cache.relaySignal}}
const relay = startOutboxRelay({ store: persistence.outbox, publisher: application.eventBus, intervalMs: config.outboxRelayIntervalMs, logger: application.logger, wakeOn: redis.relaySignal });
{{/if}}
{{#unless cache.relaySignal}}
const relay = startOutboxRelay({ store: persistence.outbox, publisher: application.eventBus, intervalMs: config.outboxRelayIntervalMs, logger: application.logger{{#if persistence.signals}}, wakeOn: persistence.relaySignal{{/if}} });
{{/unless}}
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
