// Imported first on purpose: instrumentation has to be installed before any module it patches is loaded.
import { tracing } from '{{paths.appToSource}}/platform/tracing.js';
import { {{service.selectionImport}} } from '{{paths.appToSource}}/contexts/{{context.kebab}}/{{context.kebab}}.module.js';
import { composeApplication } from '{{paths.appToSource}}/platform/application.js';
{{#if http.any}}
import { createAuthenticator } from '{{paths.appToSource}}/platform/auth/authenticator.js';
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
const application = composeApplication(persistence, { events: {{events.provider}}{{#if http.any}}, authenticator: createAuthenticator(config){{/if}} }, {{service.selection}});
await application.start();
{{#if events.outbox}}
const relay = startOutboxRelay({ store: persistence.outbox, publisher: application.eventBus, intervalMs: config.outboxRelayIntervalMs });
{{/if}}
{{#if http.any}}
const server = await startHttpServer(application.routes, config, application.boundary);
console.log(JSON.stringify({ level: 'info', message: 'listening', service: config.serviceName, context: '{{context.kebab}}', port: server.port }));
{{/if}}
{{#unless http.any}}
console.log(JSON.stringify({ level: 'info', message: 'started', service: config.serviceName, context: '{{context.kebab}}' }));
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
