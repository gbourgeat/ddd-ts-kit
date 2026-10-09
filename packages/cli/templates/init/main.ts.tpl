// Imported first on purpose: instrumentation has to be installed before any module it patches is loaded.
import { tracing } from './platform/tracing.js';
import { composeApplication } from './platform/application.js';
{{#if http.any}}
import { createAuthenticator } from './platform/auth/authenticator.js';
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
const application = composeApplication(persistence, { events: {{events.provider}}{{#if http.any}}, authenticator: createAuthenticator(config){{/if}} });
await application.start();
{{#if events.outbox}}
const relay = startOutboxRelay({ store: persistence.outbox, publisher: application.eventBus, intervalMs: config.outboxRelayIntervalMs{{#if persistence.signals}}, wakeOn: persistence.relaySignal{{/if}} });
{{/if}}
{{#if http.any}}
const server = await startHttpServer(application.routes, config, application.boundary);
console.log(JSON.stringify({ level: 'info', message: 'listening', service: config.serviceName, port: server.port }));
{{/if}}
{{#unless http.any}}
console.log(JSON.stringify({ level: 'info', message: 'started', service: config.serviceName }));
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
  await persistence.close();
  await tracing.shutdown();
}
