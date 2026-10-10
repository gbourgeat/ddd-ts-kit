// Imported first on purpose: instrumentation has to be installed before any module it patches is loaded.
import { tracing } from '{{paths.appToSource}}/platform/tracing.js';
{{#if errors.sentry}}
// Imported second on purpose: a failure while the rest of the application loads is already reported.
import { errors } from '{{paths.appToSource}}/platform/errors.js';
{{/if}}
{{#if http.any}}
import { createAuthenticator } from '{{paths.appToSource}}/platform/auth/create-authenticator.js';
{{/if}}
import { composeApplication } from '{{paths.appToSource}}/platform/compose-application.js';
import { loadConfig } from '{{paths.appToSource}}/platform/config/load-config.js';
import { openPersistence } from '{{paths.appToSource}}/platform/database/open-persistence.js';
import { {{events.providerName}} } from '{{paths.appToSource}}/platform/events/{{events.providerFile}}.js';
import { jobSettings } from '{{paths.appToSource}}/platform/job-settings.js';
{{#if cache.redis}}
import { openRedis } from '{{paths.appToSource}}/platform/redis/open-redis.js';
{{/if}}

// The scheduled jobs in a process of their own: the same modules as `main.ts`, no HTTP server{{#if events.outbox}}, no outbox relay (the API keeps the one relay){{/if}}.
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
  // This process is the one that runs the jobs, whatever `RUN_JOBS` says to the others.
  jobs: { start: true, settings: jobSettings(process.env) },
{{#if cache.redis}}
  redis,
{{/if}}
});

await application.start();
application.logger.info('started', { process: 'worker' });

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());

/** `stop` first waits for the runs in progress, then aborts them: set the termination grace of the platform above it. */
async function shutdown(): Promise<void> {
  await application.stop();
{{#if cache.redis}}
  await redis.close();
{{/if}}
  await persistence.close();
  await tracing.shutdown();
}
