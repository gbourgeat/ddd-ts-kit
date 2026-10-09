export interface AppConfig {
  readonly serviceName: string;
  readonly serviceVersion: string;
  readonly environment: Environment;
  readonly port: number;
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
{{#if broker.rabbitmq}}
  readonly amqpUrl: string;
{{/if}}
}
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
{{#if persistence.needsUrl}}
    databaseUrl: readUrl(env, 'DATABASE_URL', problems),
{{/if}}
{{#if events.outbox}}
    outboxRelayIntervalMs: readInteger(env, { name: 'OUTBOX_RELAY_INTERVAL_MS', fallback: 500, min: 10, max: 60000 }, problems),
{{/if}}
{{#if docs.any}}
    docsEnabled: readFlag(env['API_DOCS'], environment !== 'production'),
{{/if}}
{{#if broker.rabbitmq}}
    amqpUrl: readUrl(env, 'AMQP_URL', problems),
{{/if}}
{{#if authn.jwt}}
    auth: {
      issuer: readUrl(env, 'AUTH_ISSUER', problems),
      audience: readText(env, 'AUTH_AUDIENCE', problems),
      jwksUri: readUrl(env, 'AUTH_JWKS_URI', problems),
    },
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
{{#if authn.jwt}}

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
