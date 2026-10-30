{{#if cache.rateLimit}}
import type { LogLevel, RateLimit } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless cache.rateLimit}}
import type { LogLevel } from '@ddd-ts-kit/kernel';
{{/unless}}
import type { ResilienceSettings } from '{{alias.platform}}/resilience/resilience-settings{{alias.ext}}';
{{#if files.any}}
import type { FilesConfig } from '{{alias.platform}}/config/read-files{{alias.ext}}';
{{/if}}
import type { TracingConfig } from '{{alias.platform}}/config/read-tracing{{alias.ext}}';
{{#if housekeeping.any}}
import type { Housekeeping } from '{{alias.platform}}/jobs/housekeeping{{alias.ext}}';
{{/if}}

/** The validated configuration of the process: `loadConfig` is the only reader of the environment. */
export interface AppConfig {
  /** What this process is called in traces and logs (`OTEL_SERVICE_NAME`): one per container, so it tells the processes of a deployment apart. */
  readonly serviceName: string;
  /** What the processes of one deployment share (`DEPLOYMENT_NAME`, the name of the project when left out): the namespace of the keys they exchange through the server, never `serviceName`. */
  readonly deploymentName: string;
  readonly serviceVersion: string;
  readonly environment: 'development' | 'test' | 'production';
  readonly port: number;
  readonly log: LogConfig;
  /** What `tracing.ts` starts with, and whether a consumed event continues the trace of its publication. */
  readonly tracing: TracingConfig;
  /** The policy around every adapter that leaves the process (kinds `external` and `gateway`). */
  readonly resilience: ResilienceSettings;
  /** Whether this process runs the scheduled jobs (`RUN_JOBS`): off for the API of a project that has a worker. */
  readonly runJobs: boolean;
  {{#if tenancy.any}}
  /** The tenants that exist (`TENANTS`, comma separated): a job declared `per-tenant` runs once for each. Read once at the start: a tenant created later is missed. Once the tenants live in a table, make `composition/tenant-directory.ts` read it (the identity preset does). */
  readonly tenants: readonly string[];
  {{/if}}
  {{#if persistence.needsUrl}}
  readonly databaseUrl: string;
  {{/if}}
  {{#if events.outbox}}
  readonly outboxRelayIntervalMs: number;
  {{/if}}
  {{#if housekeeping.any}}
  /** How long the platform keeps what it is done with, in days (`OUTBOX_RETENTION_DAYS`, `BACKGROUND_JOBS_RETENTION_DAYS`). */
  readonly housekeeping: Housekeeping;
  {{/if}}
  {{#if docs.any}}
  readonly docsEnabled: boolean;
  {{/if}}
  {{#if authn.jwks}}
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
  {{#if httpCache.varnish}}
  /** Varnish as the API reaches it (`VARNISH_URL`): where the relay of the outbox sends the purges of the tags. */
  readonly varnishUrl: string;
  /** The key Varnish lets a purge from another machine in with (`VARNISH_PURGE_KEY`): a secret in production. */
  readonly varnishPurgeKey: string;
  {{/if}}
  {{#if cache.rateLimit}}
  /** How many requests one caller address may send in a sliding window, before the HTTP layer answers 429. */
  readonly rateLimit: RateLimit;
  {{/if}}
  {{#if http.any}}
  {{#unless http.hono}}
  /**
   * The proxies in front of the server believed when they name the caller in `X-Forwarded-For` (`TRUST_PROXY`): a
   * number of hops, or their addresses and subnets. `false` by default: the caller is the address of the socket.
   */
  readonly trustProxy: false | number | readonly string[];
  {{/unless}}
  {{#if http.hono}}
  {{#if cache.rateLimit}}
  /** How many proxies in front of the server add the caller to `X-Forwarded-For` (`TRUST_PROXY`); 0 by default, none. */
  readonly trustProxy: number;
  {{/if}}
  {{/if}}
  {{/if}}
  {{#if errors.sentry}}
  /** Where unexpected failures are reported: a Sentry or a GlitchTip project. Without a DSN nothing is reported. */
  readonly errorReporting: ErrorReportingConfig;
  {{/if}}
  {{#if files.any}}
  /** Where the content of files lives (`files/open-files.ts`), never in the database. */
  readonly files: FilesConfig;
  {{/if}}
}

/** `LOG_LEVEL`, `LOG_FORMAT` and `LOG_SCRUB_MESSAGES`. */
interface LogConfig {
  readonly level: LogLevel;
  {{#if logger.stdout}}
  /** One JSON line per entry: this logger has no pretty format (`init --logger pino` or `winston` brings one). */
  readonly format: 'json';
  {{/if}}
  {{#unless logger.stdout}}
  /** `json` everywhere; `pretty` on a developer's machine only. */
  readonly format: 'json' | 'pretty';
  {{/unless}}
  /** Writes `[message removed]` for the message of every logged error that is not a `DomainError`: for logs that leave your hands. */
  readonly scrubMessages: boolean;
}
{{#if errors.sentry}}

/** What `initSentry` is given: `SENTRY_DSN`, `SENTRY_ENVIRONMENT` (the one of `NODE_ENV` when left out), `SENTRY_RELEASE` and `SENTRY_SCRUB_MESSAGES`. */
interface ErrorReportingConfig {
  readonly dsn?: string;
  readonly environment: string;
  readonly release?: string;
  /** Removes the message of every reported error that is not a `DomainError`: for a tracker hosted by a third party. */
  readonly scrubMessages: boolean;
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
{{#if authn.jwks}}

/** Where tokens come from and whom they are for: the issuer, the audience this service answers to, the keys of the issuer. */
interface AuthConfig {
  readonly issuer: string;
  readonly audience: string;
  readonly jwksUri: string;
}
{{/if}}
