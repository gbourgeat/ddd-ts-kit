// Imported first on purpose: instrumentation has to be installed before any module it patches is loaded.
import { tracing } from '{{alias.platform}}/tracing.js';
{{#if errors.sentry}}
// Imported second on purpose: a failure while the rest of the application loads is already reported.
import { errors } from '{{alias.platform}}/errors.js';
{{/if}}
{{#if http.any}}
import { createAuthenticator } from '{{alias.platform}}/auth/create-authenticator.js';
{{/if}}
import { composeApplication } from '{{alias.platform}}/compose-application.js';
import { loadConfig } from '{{alias.platform}}/config/load-config.js';
import { openPersistence } from '{{alias.platform}}/database/open-persistence.js';
import { {{events.providerName}} } from '{{alias.platform}}/events/{{events.providerFile}}.js';
{{#if events.outbox}}
import { startOutboxRelay } from '{{alias.platform}}/events/start-outbox-relay.js';
{{/if}}
{{#if http.any}}
import { startHttpServer } from '{{alias.platform}}/http/start-http-server.js';
{{/if}}
import { jobSettings } from '{{alias.platform}}/job-settings.js';
{{#if cache.redis}}
import { openRedis } from '{{alias.platform}}/redis/open-redis.js';
{{/if}}
{{service.imports}}
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
    {{#if errors.sentry}}
    errors,
    {{/if}}
    {{#if http.any}}
    authenticator: createAuthenticator(config),
    {{/if}}
    log: { ...config.log, service: config.serviceName, environment: config.environment },
    traceConsumers: config.tracing.consumers,
    resilience: config.resilience,
    // A context run alone takes its jobs with it, and only its own.
    jobs: { start: config.runJobs, settings: jobSettings(process.env, '{{context.kebab}}') },
    {{#if cache.redis}}
    redis,
    {{/if}}
  },
  {{service.selection}}
);

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
