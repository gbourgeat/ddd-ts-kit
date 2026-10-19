// Imported first on purpose: instrumentation has to be installed before any module it patches is loaded.
import { tracing } from '@/platform/observability/tracing';
// Imported second on purpose: a failure while the rest of the application loads is already reported.
import { errors } from '@/platform/observability/errors';
import { createAuthenticator } from '@/platform/auth/authentication/create-authenticator';
import { composeApplication } from '@/platform/composition/compose-application';
import { loadConfig } from '@/platform/config/load-config';
import { openPersistence } from '@/platform/database/open-persistence';
import { createEventProvider } from '@/platform/events/create-event-provider';
import { openFiles } from '@/platform/files/open-files';
import { jobSettings } from '@/platform/jobs/job-settings';
import { openRedis } from '@/platform/redis/open-redis';

// The scheduled jobs in a process of their own: the same modules as `main.ts`, no HTTP server, no outbox relay (the API keeps the one relay).
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
  // This process is the one that runs the jobs, whatever `RUN_JOBS` says to the others.
  jobs: { start: true, settings: jobSettings(process.env) },
  redis,
  files: openFiles(config.files),
});

await application.start();
application.logger.info('started', { process: 'worker' });

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());

/** `stop` first waits for the runs in progress, then aborts them: set the termination grace of the platform above it. */
async function shutdown(): Promise<void> {
  await application.stop();
  await redis.close();
  await persistence.close();
  await tracing.shutdown();
}
