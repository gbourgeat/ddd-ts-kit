// Imported first on purpose: instrumentation has to be installed before any module it patches is loaded.
import { tracing } from '{{alias.platform}}/tracing{{alias.ext}}';
{{#if errors.sentry}}
// Imported second on purpose: a failure while the rest of the application loads is already reported.
import { errors } from '{{alias.platform}}/errors{{alias.ext}}';
{{/if}}
{{#if httpCache.varnish}}
import { VarnishCachePurger } from '@ddd-ts-kit/http/purgers';
import { PurgingPublisher } from '@ddd-ts-kit/kernel';
{{/if}}
{{#if http.any}}
import { createAuthenticator } from '{{alias.platform}}/auth/create-authenticator{{alias.ext}}';
{{/if}}
import { composeApplication } from '{{alias.platform}}/compose-application{{alias.ext}}';
import { loadConfig } from '{{alias.platform}}/config/load-config{{alias.ext}}';
import { openPersistence } from '{{alias.platform}}/database/open-persistence{{alias.ext}}';
import { {{events.providerName}} } from '{{alias.platform}}/events/{{events.providerFile}}{{alias.ext}}';
{{#if events.outbox}}
import { startOutboxRelay } from '{{alias.platform}}/events/start-outbox-relay{{alias.ext}}';
{{/if}}
{{#if http.any}}
import { startHttpServer } from '{{alias.platform}}/http/start-http-server{{alias.ext}}';
{{/if}}
import { jobSettings } from '{{alias.platform}}/job-settings{{alias.ext}}';
{{#if cache.redis}}
import { openRedis } from '{{alias.platform}}/redis/open-redis{{alias.ext}}';
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
  {{#if httpCache.varnish}}
  // The purge requests the use cases wrote with their commands go to Varnish, every other event to the provider.
  publisher: new PurgingPublisher(
    new VarnishCachePurger({ url: config.varnishUrl, key: config.varnishPurgeKey }),
    application.eventBus,
  ),
  {{/if}}
  {{#unless httpCache.varnish}}
  publisher: application.eventBus,
  {{/unless}}
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
