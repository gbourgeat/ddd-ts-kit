// Imported first on purpose: instrumentation has to be installed before any module it patches is loaded.
import { tracing } from '{{alias.platform}}/tracing{{alias.ext}}';
{{#if errors.sentry}}
// Imported second on purpose: a failure while the rest of the application loads is already reported.
import { errors } from '{{alias.platform}}/errors{{alias.ext}}';
{{/if}}
{{#if http.any}}
import { createAuthenticator } from '{{alias.platform}}/auth/create-authenticator{{alias.ext}}';
{{/if}}
import { composeApplication } from '{{alias.platform}}/compose-application{{alias.ext}}';
import { loadConfig } from '{{alias.platform}}/config/load-config{{alias.ext}}';
import { openPersistence } from '{{alias.platform}}/database/open-persistence{{alias.ext}}';
import { {{events.providerName}} } from '{{alias.platform}}/events/{{events.providerFile}}{{alias.ext}}';
{{#if files.any}}
import { openFiles } from '{{alias.platform}}/files/open-files{{alias.ext}}';
{{/if}}
import { jobSettings } from '{{alias.platform}}/job-settings{{alias.ext}}';
{{#if cache.redis}}
import { openRedis } from '{{alias.platform}}/redis/open-redis{{alias.ext}}';
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
{{#if files.any}}
  files: openFiles(config.files),
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
