// Imported first on purpose: instrumentation has to be installed before any module it patches is loaded.
import { tracing } from '{{paths.appToSource}}/platform/tracing.js';
{{service.imports}}
import { composeApplication } from '{{paths.appToSource}}/platform/application.js';
{{#if http.any}}
import { createAuthenticator } from '{{paths.appToSource}}/platform/auth/authenticator.js';
{{/if}}
{{#if cache.redis}}
import { openRedis } from '{{paths.appToSource}}/platform/cache.js';
{{/if}}
import { loadConfig } from '{{paths.appToSource}}/platform/config.js';
import { openPersistence } from '{{paths.appToSource}}/platform/database/persistence.js';
import { {{events.providerName}} } from '{{paths.appToSource}}/platform/events.js';
{{#if http.any}}
import { startHttpServer } from '{{paths.appToSource}}/platform/http-server.js';
{{/if}}
{{#if events.outbox}}
import { startOutboxRelay } from '{{paths.appToSource}}/platform/outbox-relay.js';
{{/if}}

// The context "{{context.kebab}}" alone, on the kernel and the platform: the same code as in the whole application, another composition root.
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
const application = composeApplication(
  persistence,
  {
    events: {{events.provider}},
{{#if http.any}}
    authenticator: createAuthenticator(config),
{{/if}}
    log: { level: config.logLevel, service: config.serviceName },
    resilience: config.resilience,
{{#if cache.redis}}
    redis,
{{/if}}
  },
  {{service.selection}},
);
await application.start();
{{#if events.outbox}}
{{#if cache.relaySignal}}
const relay = startOutboxRelay({ store: persistence.outbox, publisher: application.eventBus, intervalMs: config.outboxRelayIntervalMs, logger: application.logger, wakeOn: redis.relaySignal });
{{/if}}
{{#unless cache.relaySignal}}
const relay = startOutboxRelay({ store: persistence.outbox, publisher: application.eventBus, intervalMs: config.outboxRelayIntervalMs, logger: application.logger });
{{/unless}}
{{/if}}
{{#if http.any}}
const server = await startHttpServer(application, config);
application.logger.info('listening', { context: '{{context.kebab}}', port: server.port });
{{/if}}
{{#unless http.any}}
application.logger.info('started', { context: '{{context.kebab}}' });
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
