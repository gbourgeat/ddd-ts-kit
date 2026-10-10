import { LOG_LEVELS, type LogLevel } from '@ddd-ts-kit/kernel';

export interface AppConfig {
  readonly serviceName: string;
  readonly serviceVersion: string;
  readonly environment: Environment;
  readonly port: number;
  readonly logLevel: LogLevel;
  readonly resilience: ResilienceConfig;
{{#if persistence.needsUrl}}
  readonly databaseUrl: string;
{{/if}}
{{#if events.outbox}}
  readonly outboxRelayIntervalMs: number;
{{/if}}
{{#if docs.any}}
  readonly docsEnabled: boolean;
{{/if}}
{{#if authn.jwt}}
  readonly auth: AuthConfig;
{{/if}}
{{#if authn.keycloak}}
  readonly keycloak: KeycloakConfig;
{{/if}}
{{#if broker.addressed}}
  readonly {{broker.key}}: string;
{{/if}}
{{#if redis.server}}
  readonly redisUrl: string;
{{/if}}
{{#if cache.rateLimit}}
  readonly rateLimit: RateLimitConfig;
{{/if}}
}

/** The policy around every adapter that leaves the process (kinds `external` and `gateway`): how often to try again, and how long one attempt may last. */
export interface ResilienceConfig {
  readonly retryAttempts: number;
  readonly retryBaseDelayMs: number;
  readonly timeoutMs: number;
}
{{#if cache.rateLimit}}

/** How many requests one caller address may send in a sliding window, before the HTTP layer answers 429. */
export interface RateLimitConfig {
  readonly limit: number;
  readonly windowMs: number;
}
{{/if}}
{{#if authn.keycloak}}

/** The realm tokens come from, and the audience this service answers to; the client id adds its client roles to the realm roles. */
interface KeycloakConfig {
  readonly baseUrl: string;
  readonly realm: string;
  readonly audience: string;
  readonly clientId?: string;
}
{{/if}}
{{#if authn.jwt}}

/** Where tokens come from and whom they are for: the issuer, the audience this service answers to, the keys of the issuer. */
interface AuthConfig {
  readonly issuer: string;
  readonly audience: string;
  readonly jwksUri: string;
}
{{/if}}

const ENVIRONMENTS = ['development', 'test', 'production'] as const;
type Environment = (typeof ENVIRONMENTS)[number];

type Variables = Readonly<Record<string, string | undefined>>;

export class ConfigError extends Error {
  constructor(readonly problems: readonly string[]) {
    super('Invalid configuration: ' + problems.join('; '));
    this.name = 'ConfigError';
  }
}

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
    logLevel: readLogLevel(env, problems),
    resilience: readResilience(env, problems),
{{#if persistence.needsUrl}}
    databaseUrl: readUrl(env, 'DATABASE_URL', problems),
{{/if}}
{{#if events.outbox}}
    outboxRelayIntervalMs: readInteger(env, { name: 'OUTBOX_RELAY_INTERVAL_MS', fallback: 500, min: 10, max: 60000 }, problems),
{{/if}}
{{#if docs.any}}
    docsEnabled: readFlag(env['API_DOCS'], environment !== 'production'),
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
  };
  if (problems.length > 0) {
    throw new ConfigError(problems);
  }
  return config;
}

function readEnvironment(env: Variables, problems: string[]): Environment {
  const raw = env['NODE_ENV'] ?? 'development';
  const environment = ENVIRONMENTS.find((candidate) => candidate === raw);
  if (environment === undefined) {
    problems.push('NODE_ENV must be one of ' + ENVIRONMENTS.join(', '));
  }
  return environment ?? 'development';
}

function readLogLevel(env: Variables, problems: string[]): LogLevel {
  const raw = env['LOG_LEVEL'] ?? 'info';
  const level = LOG_LEVELS.find((candidate) => candidate === raw);
  if (level === undefined) {
    problems.push('LOG_LEVEL must be one of ' + LOG_LEVELS.join(', '));
  }
  return level ?? 'info';
}

function readResilience(env: Variables, problems: string[]): ResilienceConfig {
  return {
    retryAttempts: readInteger(env, { name: 'OUTBOUND_RETRY_ATTEMPTS', fallback: 3, min: 1, max: 10 }, problems),
    retryBaseDelayMs: readInteger(env, { name: 'OUTBOUND_RETRY_BASE_DELAY_MS', fallback: 100, min: 1, max: 60000 }, problems),
    timeoutMs: readInteger(env, { name: 'OUTBOUND_TIMEOUT_MS', fallback: 2000, min: 1, max: 600000 }, problems),
  };
}
{{#if cache.rateLimit}}

function readRateLimit(env: Variables, problems: string[]): RateLimitConfig {
  return {
    limit: readInteger(env, { name: 'RATE_LIMIT_MAX', fallback: 120, min: 1, max: 1000000 }, problems),
    windowMs: readInteger(env, { name: 'RATE_LIMIT_WINDOW_MS', fallback: 60000, min: 100, max: 3600000 }, problems),
  };
}
{{/if}}
{{#if authn.jwt}}

function readAuth(env: Variables, problems: string[]): AuthConfig {
  return {
    issuer: readUrl(env, 'AUTH_ISSUER', problems),
    audience: readText(env, 'AUTH_AUDIENCE', problems),
    jwksUri: readUrl(env, 'AUTH_JWKS_URI', problems),
  };
}
{{/if}}
{{#if authn.keycloak}}

function readKeycloak(env: Variables, problems: string[]): KeycloakConfig {
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
{{#if docs.any}}

function readFlag(raw: string | undefined, fallback: boolean): boolean {
  return raw === undefined || raw === '' ? fallback : raw === 'true' || raw === '1';
}
{{/if}}
