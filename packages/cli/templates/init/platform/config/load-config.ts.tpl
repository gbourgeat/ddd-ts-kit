{{#if http.any}}
{{#unless http.hono}}
import { isIP } from 'node:net';
{{/unless}}
{{/if}}
{{#if tenancy.any}}
import { LOG_LEVELS, isTenantId } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless tenancy.any}}
import { LOG_LEVELS } from '@ddd-ts-kit/kernel';
{{/unless}}
import type { AppConfig } from '{{alias.platform}}/config/app-config{{alias.ext}}';
import { Environment, type Variables } from '{{alias.platform}}/config/environment{{alias.ext}}';
{{#if files.any}}
import { readFiles } from '{{alias.platform}}/config/read-files{{alias.ext}}';
{{/if}}
import { readTracing } from '{{alias.platform}}/config/read-tracing{{alias.ext}}';
{{#if housekeeping.any}}
import { DEFAULT_HOUSEKEEPING, type Housekeeping } from '{{alias.platform}}/jobs/housekeeping{{alias.ext}}';
{{/if}}

const environments = ['development', 'test', 'production'] as const;
{{#if http.any}}
{{#unless http.hono}}

/** What Express and Fastify name the private ranges, besides the addresses and the subnets. */
const PROXY_RANGES = ['loopback', 'linklocal', 'uniquelocal'];
{{/unless}}
{{/if}}

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
{{#if authn.none}}

  requireEnvironmentForTheDevelopmentHeader(env);
{{/if}}
{{#if authz.rebac}}

  requireEnvironmentForTheTupleStore(env);
{{/if}}

  const config: AppConfig = {
    ...readIdentity(env),
    environment,
    port: env.integer('PORT', { fallback: 3000, min: 0, max: 65535 }),
    log: readLog(env),
    tracing: readTracing(env),
    resilience: readResilience(env),
    runJobs: env.flag('RUN_JOBS', runJobsByDefault),
    {{#if tenancy.any}}
    tenants: readTenants(env),
    {{/if}}
    {{#if persistence.needsUrl}}
    databaseUrl: env.url('DATABASE_URL'),
    {{/if}}
    {{#if orm.prisma}}
    databaseTransaction: readDatabaseTransaction(env),
    {{/if}}
    {{#if events.outbox}}
    outboxRelayIntervalMs: env.integer('OUTBOX_RELAY_INTERVAL_MS', { fallback: 500, min: 10, max: 60000 }),
    {{/if}}
    {{#if housekeeping.any}}
    housekeeping: readHousekeeping(env),
    {{/if}}
    {{#if docs.any}}
    docsEnabled: env.flag('API_DOCS', environment !== 'production'),
    {{/if}}
    {{#if broker.addressed}}
    {{broker.key}}: env.{{broker.reader}}('{{broker.variable}}'),
    {{/if}}
    {{#if authn.jwks}}
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
    {{#if http.any}}
    {{#unless http.hono}}
    trustProxy: readTrustProxy(env),
    {{/unless}}
    {{#if http.hono}}
    {{#if cache.rateLimit}}
    trustProxy: env.integer('TRUST_PROXY', { fallback: 0, min: 0, max: 32 }),
    {{/if}}
    {{/if}}
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
    {{#if search.opensearch}}
    search: readSearch(env),
    {{/if}}
  };

  env.assertValid();

  return config;
}

/** What this process is called, in its deployment and in its version. */
function readIdentity(env: Environment): Pick<AppConfig, 'serviceName' | 'deploymentName' | 'serviceVersion'> {
  return {
    serviceName: env.optional('OTEL_SERVICE_NAME') ?? '{{project.name}}',
    deploymentName: env.optional('DEPLOYMENT_NAME') ?? '{{project.name}}',
    serviceVersion: env.optional('SERVICE_VERSION') ?? '0.0.0',
  };
}

{{#if authn.none}}
/** The development header is believed where NODE_ENV says so, never by default. */
function requireEnvironmentForTheDevelopmentHeader(env: Environment): void {
  if (env.optional('NODE_ENV') === undefined) {
    env.problem('NODE_ENV must be development or test: the development header is believed there only');
  }
}

{{/if}}
{{#if authz.rebac}}
/**
 * The in-memory tuple store of createTupleStore runs where NODE_ENV says so, never by default:
 * drop this check once createTupleStore binds a store that persists.
 */
function requireEnvironmentForTheTupleStore(env: Environment): void {
  if (env.optional('NODE_ENV') === undefined) {
    env.problem(
      'NODE_ENV must be set: the in-memory relation tuple store of createTupleStore runs in development and test only, and an unset NODE_ENV says neither',
    );
  }
}

{{/if}}
{{#if housekeeping.any}}
/** How long the platform keeps what it is done with, in days; past that, the nightly purges drop it. */
function readHousekeeping(env: Environment): Housekeeping {
  const days = (name: string, fallback: number): number => env.integer(name, { fallback, min: 1, max: 3650 });

  return {
    {{#if events.outbox}}
    publishedEventsDays: days('OUTBOX_RETENTION_DAYS', DEFAULT_HOUSEKEEPING.publishedEventsDays),
    {{/if}}
    {{#if queue.stored}}
    finishedJobsDays: days('BACKGROUND_JOBS_RETENTION_DAYS', DEFAULT_HOUSEKEEPING.finishedJobsDays),
    {{/if}}
  };
}

{{/if}}
{{#if orm.prisma}}
/**
 * The limits of an interactive transaction of Prisma: 10 seconds of waiting for a connection and
 * 30 of work by default, where Prisma gives up after 2 and 5. Not more: a caller gives up near 30
 * seconds, and a connection held longer for an answer nobody reads sheds no load.
 */
function readDatabaseTransaction(env: Environment): AppConfig['databaseTransaction'] {
  return {
    waitMs: env.integer('DATABASE_TRANSACTION_WAIT_MS', { fallback: 10_000, min: 1, max: 3_600_000 }),
    timeoutMs: env.integer('DATABASE_TRANSACTION_TIMEOUT_MS', { fallback: 30_000, min: 1, max: 3_600_000 }),
  };
}

{{/if}}
{{#if tenancy.any}}
/** `TENANTS=acme,globex`: each id in the grammar of a tenant id. */
function readTenants(env: Environment): readonly string[] {
  const tenants = (env.optional('TENANTS') ?? '')
    .split(',')
    .map((tenant) => tenant.trim())
    .filter((tenant) => tenant !== '');

  if (!tenants.every(isTenantId)) {
    env.problem('TENANTS must list tenant ids: letters, digits, _ and -, at most 63 characters each');
  }
{{#if search.opensearch}}

  // A tenant is part of the name of its search index, which OpenSearch keeps in lower case.
  if (tenants.some((tenant) => tenant !== tenant.toLowerCase())) {
    env.problem('TENANTS must be lower case: each tenant names a search index of OpenSearch');
  }
{{/if}}

  return tenants;
}

{{/if}}
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

{{#if search.opensearch}}
/** The node of OpenSearch, and the user of its security plugin: both or neither. */
function readSearch(env: Environment): AppConfig['search'] {
  const username = env.optional('OPENSEARCH_USERNAME');
  const password = env.optional('OPENSEARCH_PASSWORD');

  if ((username === undefined) !== (password === undefined)) {
    env.problem('OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD must be set together, or neither');
  }

  return {
    node: env.url('OPENSEARCH_URL'),
    ...(username === undefined ? {} : { username }),
    ...(password === undefined ? {} : { password }),
  };
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
{{#if http.any}}
{{#unless http.hono}}

/**
 * `TRUST_PROXY=1`: the nearest proxy, a load balancer, is believed when it names the caller in
 * `X-Forwarded-For`; `TRUST_PROXY=10.0.0.0/8,loopback`: the proxies at those addresses. Left out,
 * none is: behind a proxy every caller would then have its address, and share one window of the
 * rate limit.
 */
function readTrustProxy(env: Environment): AppConfig['trustProxy'] {
  const written = env.optional('TRUST_PROXY');

  if (written === undefined) {
    return false;
  }

  if (/^\d+$/.test(written)) {
    return env.integer('TRUST_PROXY', { fallback: 0, min: 0, max: 32 });
  }

  const proxies = written.split(',').map((proxy) => proxy.trim());

  if (!proxies.every(isProxy)) {
    env.problem('TRUST_PROXY must be a number of proxies, or their addresses, subnets or ranges, comma separated');
  }

  return proxies;
}

/** `10.0.0.1`, `10.0.0.0/8`, `fd00::/8`, or the name of a range. */
function isProxy(proxy: string): boolean {
  const [address = '', bits, ...rest] = proxy.split('/');
  const version = isIP(address);

  if (version === 0) {
    return PROXY_RANGES.includes(proxy);
  }

  const widest = version === 4 ? 32 : 128;

  return rest.length === 0 && (bits === undefined || (/^\d+$/.test(bits) && Number(bits) <= widest));
}
{{/unless}}
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
{{#if authn.jwks}}

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
