import { LOG_LEVELS } from '@ddd-ts-kit/kernel';
import type { AppConfig } from '{{alias.platform}}/config/app-config{{alias.ext}}';
import { Environment, type Variables } from '{{alias.platform}}/config/environment{{alias.ext}}';
{{#if files.any}}
import { readFiles } from '{{alias.platform}}/config/read-files{{alias.ext}}';
{{/if}}
import { readTracing } from '{{alias.platform}}/config/read-tracing{{alias.ext}}';

const environments = ['development', 'test', 'production'] as const;

/** Whether a process runs the scheduled jobs when `RUN_JOBS` does not say. `ddd-ts-kit generate worker` turns it off: the worker then runs them. */
// ddd-ts-kit:run-jobs
{{#if worker.off}}
const runJobsByDefault = true;
{{/if}}
{{#if worker.on}}
const runJobsByDefault = false;
{{/if}}
// /ddd-ts-kit:run-jobs

/**
 * Fails fast: every problem is collected and reported at once, by variable name only
 * (values may be secrets), before anything starts listening.
 */
export function loadConfig(variables: Variables): AppConfig {
  const env = new Environment(variables);
  const environment = env.oneOf('NODE_ENV', environments, 'development');

  const config: AppConfig = {
    serviceName: env.optional('OTEL_SERVICE_NAME') ?? '{{project.name}}',
    serviceVersion: env.optional('SERVICE_VERSION') ?? '0.0.0',
    environment,
    port: env.integer('PORT', { fallback: 3000, min: 0, max: 65535 }),
    log: readLog(env),
    tracing: readTracing(env),
    resilience: readResilience(env),
    runJobs: env.flag('RUN_JOBS', runJobsByDefault),
    {{#if persistence.needsUrl}}
    databaseUrl: env.url('DATABASE_URL'),
    {{/if}}
    {{#if events.outbox}}
    outboxRelayIntervalMs: env.integer('OUTBOX_RELAY_INTERVAL_MS', { fallback: 500, min: 10, max: 60000 }),
    {{/if}}
    {{#if docs.any}}
    docsEnabled: env.flag('API_DOCS', environment !== 'production'),
    {{/if}}
    {{#if broker.addressed}}
    {{broker.key}}: env.{{broker.reader}}('{{broker.variable}}'),
    {{/if}}
    {{#if authn.jwt}}
    auth: readAuth(env),
    {{/if}}
    {{#if authn.keycloak}}
    keycloak: readKeycloak(env),
    {{/if}}
    {{#if redis.server}}
    redisUrl: env.url('REDIS_URL'),
    {{/if}}
    {{#if httpCache.varnish}}
    varnishUrl: env.url('VARNISH_URL'),
    varnishPurgeKey: env.text('VARNISH_PURGE_KEY'),
    {{/if}}
    {{#if cache.rateLimit}}
    rateLimit: readRateLimit(env),
    {{/if}}
    {{#if errors.sentry}}
    errorReporting: readErrorReporting(env, environment),
    {{/if}}
    {{#if files.local}}
    files: readFiles(env, environment),
    {{/if}}
    {{#if files.s3}}
    files: readFiles(env),
    {{/if}}
  };

  env.assertValid();

  return config;
}

function readLog(env: Environment): AppConfig['log'] {
  return {
    level: env.oneOf('LOG_LEVEL', LOG_LEVELS, 'info'),
    {{#if logger.stdout}}
    format: readLogFormat(env),
    {{/if}}
    {{#unless logger.stdout}}
    format: env.oneOf('LOG_FORMAT', ['json', 'pretty'], 'json'),
    {{/unless}}
    scrubMessages: env.flag('LOG_SCRUB_MESSAGES', false),
  };
}
{{#if logger.stdout}}

/** The stdout logger has no pretty format: `LOG_FORMAT` may only say `json`. */
function readLogFormat(env: Environment): AppConfig['log']['format'] {
  if ((env.optional('LOG_FORMAT') ?? 'json') !== 'json') {
    env.problem('LOG_FORMAT must be json: the stdout logger has no pretty format');
  }

  return 'json';
}
{{/if}}

function readResilience(env: Environment): AppConfig['resilience'] {
  return {
    retryAttempts: env.integer('OUTBOUND_RETRY_ATTEMPTS', { fallback: 3, min: 1, max: 10 }),
    retryBaseDelayMs: env.integer('OUTBOUND_RETRY_BASE_DELAY_MS', { fallback: 100, min: 1, max: 60000 }),
    timeoutMs: env.integer('OUTBOUND_TIMEOUT_MS', { fallback: 2000, min: 1, max: 600000 }),
  };
}
{{#if cache.rateLimit}}

function readRateLimit(env: Environment): AppConfig['rateLimit'] {
  return {
    limit: env.integer('RATE_LIMIT_MAX', { fallback: 120, min: 1, max: 1000000 }),
    windowMs: env.integer('RATE_LIMIT_WINDOW_MS', { fallback: 60000, min: 100, max: 3600000 }),
  };
}
{{/if}}
{{#if errors.sentry}}

/** An empty `SENTRY_DSN` is a choice, not a problem: the application starts and reports nothing. */
function readErrorReporting(env: Environment, environment: string): AppConfig['errorReporting'] {
  const dsn = env.optionalUrl('SENTRY_DSN', 'to report nothing');
  const release = env.optional('SENTRY_RELEASE');

  return {
    ...(dsn === undefined ? {} : { dsn }),
    environment: env.optional('SENTRY_ENVIRONMENT') ?? environment,
    ...(release === undefined ? {} : { release }),
    scrubMessages: env.flag('SENTRY_SCRUB_MESSAGES', false),
  };
}
{{/if}}
{{#if authn.jwt}}

function readAuth(env: Environment): AppConfig['auth'] {
  return {
    issuer: env.url('AUTH_ISSUER'),
    audience: env.text('AUTH_AUDIENCE'),
    jwksUri: env.url('AUTH_JWKS_URI'),
  };
}
{{/if}}
{{#if authn.keycloak}}

function readKeycloak(env: Environment): AppConfig['keycloak'] {
  const clientId = env.optional('KEYCLOAK_CLIENT_ID');

  return {
    baseUrl: env.url('KEYCLOAK_URL'),
    realm: env.text('KEYCLOAK_REALM'),
    audience: env.text('KEYCLOAK_AUDIENCE'),
    ...(clientId === undefined ? {} : { clientId }),
  };
}
{{/if}}
