import { LOG_LEVELS, type LogLevel } from '@ddd-ts-kit/kernel';
import type { AppConfig } from '{{alias.platform}}/config/app-config{{alias.ext}}';
import { ConfigError } from '{{alias.platform}}/config/config-error{{alias.ext}}';
import { readTracing } from '{{alias.platform}}/config/read-tracing{{alias.ext}}';

const environments = ['development', 'test', 'production'] as const;

type Variables = Readonly<Record<string, string | undefined>>;

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
export function loadConfig(env: Variables): AppConfig {
  const problems: string[] = [];
  const environment = readEnvironment(env, problems);

  const config: AppConfig = {
    serviceName: env['OTEL_SERVICE_NAME'] ?? '{{project.name}}',
    serviceVersion: env['SERVICE_VERSION'] ?? '0.0.0',
    environment,
    port: readInteger(env, { name: 'PORT', fallback: 3000, min: 0, max: 65535 }, problems),
    log: readLog(env, problems),
    tracing: readTracing(env, problems),
    resilience: readResilience(env, problems),
    runJobs: readFlag(env, { name: 'RUN_JOBS', fallback: runJobsByDefault }, problems),
    {{#if persistence.needsUrl}}
    databaseUrl: readUrl(env, 'DATABASE_URL', problems),
    {{/if}}
    {{#if events.outbox}}
    outboxRelayIntervalMs: readInteger(
      env,
      { name: 'OUTBOX_RELAY_INTERVAL_MS', fallback: 500, min: 10, max: 60000 },
      problems,
    ),
    {{/if}}
    {{#if docs.any}}
    docsEnabled: readFlag(env, { name: 'API_DOCS', fallback: environment !== 'production' }, problems),
    {{/if}}
    {{#if broker.addressed}}
    {{broker.key}}: {{broker.reader}}(env, '{{broker.variable}}', problems),
    {{/if}}
    {{#if authn.jwt}}
    auth: readAuth(env, problems),
    {{/if}}
    {{#if authn.keycloak}}
    keycloak: readKeycloak(env, problems),
    {{/if}}
    {{#if redis.server}}
    redisUrl: readUrl(env, 'REDIS_URL', problems),
    {{/if}}
    {{#if cache.rateLimit}}
    rateLimit: readRateLimit(env, problems),
    {{/if}}
    {{#if errors.sentry}}
    errorReporting: readErrorReporting(env, environment, problems),
    {{/if}}
  };

  if (problems.length > 0) {
    throw new ConfigError(problems);
  }

  return config;
}

function readEnvironment(env: Variables, problems: string[]): AppConfig['environment'] {
  const raw = env['NODE_ENV'] ?? 'development';
  const environment = environments.find((candidate) => candidate === raw);

  if (environment === undefined) {
    problems.push('NODE_ENV must be one of ' + environments.join(', '));
  }

  return environment ?? 'development';
}

function readLog(env: Variables, problems: string[]): AppConfig['log'] {
  return {
    level: readLogLevel(env, problems),
    format: readLogFormat(env, problems),
    scrubMessages: readFlag(env, { name: 'LOG_SCRUB_MESSAGES', fallback: false }, problems),
  };
}

function readLogLevel(env: Variables, problems: string[]): LogLevel {
  const raw = env['LOG_LEVEL'] ?? 'info';
  const level = LOG_LEVELS.find((candidate) => candidate === raw);

  if (level === undefined) {
    problems.push('LOG_LEVEL must be one of ' + LOG_LEVELS.join(', '));
  }

  return level ?? 'info';
}

function readLogFormat(env: Variables, problems: string[]): AppConfig['log']['format'] {
  const raw = env['LOG_FORMAT'] ?? 'json';

  {{#if logger.stdout}}
  if (raw !== 'json') {
    problems.push('LOG_FORMAT must be json: the stdout logger has no pretty format');
  }

  return 'json';
  {{/if}}
  {{#unless logger.stdout}}
  if (raw !== 'json' && raw !== 'pretty') {
    problems.push('LOG_FORMAT must be json or pretty');
  }

  return raw === 'pretty' ? 'pretty' : 'json';
  {{/unless}}
}

function readResilience(env: Variables, problems: string[]): AppConfig['resilience'] {
  return {
    retryAttempts: readInteger(env, { name: 'OUTBOUND_RETRY_ATTEMPTS', fallback: 3, min: 1, max: 10 }, problems),
    retryBaseDelayMs: readInteger(
      env,
      { name: 'OUTBOUND_RETRY_BASE_DELAY_MS', fallback: 100, min: 1, max: 60000 },
      problems,
    ),
    timeoutMs: readInteger(env, { name: 'OUTBOUND_TIMEOUT_MS', fallback: 2000, min: 1, max: 600000 }, problems),
  };
}
{{#if cache.rateLimit}}

function readRateLimit(env: Variables, problems: string[]): AppConfig['rateLimit'] {
  return {
    limit: readInteger(env, { name: 'RATE_LIMIT_MAX', fallback: 120, min: 1, max: 1000000 }, problems),
    windowMs: readInteger(env, { name: 'RATE_LIMIT_WINDOW_MS', fallback: 60000, min: 100, max: 3600000 }, problems),
  };
}
{{/if}}
{{#if errors.sentry}}

/** An empty `SENTRY_DSN` is a choice, not a problem: the application starts and reports nothing. */
function readErrorReporting(env: Variables, environment: string, problems: string[]): AppConfig['errorReporting'] {
  const dsn = (env['SENTRY_DSN'] ?? '').trim();
  const named = (env['SENTRY_ENVIRONMENT'] ?? '').trim();
  const release = (env['SENTRY_RELEASE'] ?? '').trim();

  if (dsn !== '' && !URL.canParse(dsn)) {
    problems.push('SENTRY_DSN must be a URL, or empty to report nothing');
  }

  return {
    ...(dsn === '' ? {} : { dsn }),
    environment: named === '' ? environment : named,
    ...(release === '' ? {} : { release }),
    scrubMessages: readFlag(env, { name: 'SENTRY_SCRUB_MESSAGES', fallback: false }, problems),
  };
}
{{/if}}
{{#if authn.jwt}}

function readAuth(env: Variables, problems: string[]): AppConfig['auth'] {
  return {
    issuer: readUrl(env, 'AUTH_ISSUER', problems),
    audience: readText(env, 'AUTH_AUDIENCE', problems),
    jwksUri: readUrl(env, 'AUTH_JWKS_URI', problems),
  };
}
{{/if}}
{{#if authn.keycloak}}

function readKeycloak(env: Variables, problems: string[]): AppConfig['keycloak'] {
  const clientId = env['KEYCLOAK_CLIENT_ID'] ?? '';

  return {
    baseUrl: readUrl(env, 'KEYCLOAK_URL', problems),
    realm: readText(env, 'KEYCLOAK_REALM', problems),
    audience: readText(env, 'KEYCLOAK_AUDIENCE', problems),
    ...(clientId.trim() === '' ? {} : { clientId }),
  };
}
{{/if}}

interface IntegerVariable {
  readonly name: string;
  readonly fallback: number;
  readonly min: number;
  readonly max: number;
}

function readInteger(env: Variables, variable: IntegerVariable, problems: string[]): number {
  const raw = env[variable.name];
  const value = raw === undefined || raw === '' ? variable.fallback : Number(raw);

  if (!Number.isInteger(value) || value < variable.min || value > variable.max) {
    problems.push(variable.name + ' must be an integer between ' + variable.min + ' and ' + variable.max);
  }

  return value;
}

interface FlagVariable {
  readonly name: string;
  readonly fallback: boolean;
}

const flags: Readonly<Record<string, boolean>> = { true: true, '1': true, false: false, '0': false };

function readFlag(env: Variables, variable: FlagVariable, problems: string[]): boolean {
  const raw = env[variable.name];

  if (raw === undefined || raw === '') {
    return variable.fallback;
  }

  const value = flags[raw];

  if (value === undefined) {
    problems.push(variable.name + ' must be true or false');
  }

  return value ?? variable.fallback;
}
{{#if needs.url}}

function readUrl(env: Variables, name: string, problems: string[]): string {
  const raw = env[name] ?? '';

  if (!URL.canParse(raw)) {
    problems.push(name + ' must be a URL');
  }

  return raw;
}
{{/if}}
{{#if needs.text}}

function readText(env: Variables, name: string, problems: string[]): string {
  const raw = env[name] ?? '';

  if (raw.trim() === '') {
    problems.push(name + ' must be set');
  }

  return raw;
}
{{/if}}
