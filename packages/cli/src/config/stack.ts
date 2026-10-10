export const HTTP_STACKS = ['express', 'fastify', 'nest', 'none'] as const;
export const VALIDATION_STACKS = ['zod', 'class-validator', 'standard-schema', 'none'] as const;
export const DI_STACKS = ['tsyringe', 'nest', 'manual'] as const;
export const EVENT_STACKS = ['in-memory', 'outbox', 'custom'] as const;
export const ORM_STACKS = ['drizzle', 'knex', 'prisma', 'typeorm', 'custom', 'none'] as const;
export const DATABASE_STACKS = ['postgres', 'mysql', 'sqlite', 'mongodb', 'none'] as const;
export const TEST_STACKS = ['vitest', 'jest'] as const;
export const DOCS_UIS = ['swagger', 'scalar', 'redoc', 'none'] as const;
export const CI_PLATFORMS = ['github', 'gitlab', 'both', 'none'] as const;
export const AUTHN_STACKS = ['jwt', 'keycloak', 'none'] as const;
export const AUTHZ_STACKS = ['rbac', 'abac', 'rebac', 'custom'] as const;
export const BROKER_STACKS = ['none', 'rabbitmq', 'kafka', 'nats', 'redis', 'custom'] as const;
export const STYLES = ['declared', 'explicit'] as const;
export const ASSEMBLIES = ['barrel', 'discovery'] as const;
export const CACHE_STACKS = ['none', 'redis'] as const;
export const AUDIT_MODES = ['on', 'off'] as const;
export const ERROR_REPORTERS = ['none', 'sentry'] as const;
export const LOGGERS = ['stdout', 'pino', 'winston'] as const;

export type ValidationStack = (typeof VALIDATION_STACKS)[number];
export type OrmStack = (typeof ORM_STACKS)[number];

export interface Stack {
  readonly http: (typeof HTTP_STACKS)[number];
  readonly validation: ValidationStack;
  readonly di: (typeof DI_STACKS)[number];
  readonly events: (typeof EVENT_STACKS)[number];
  readonly orm: OrmStack;
  readonly database: (typeof DATABASE_STACKS)[number];
  readonly tests: (typeof TEST_STACKS)[number];
  /** The interactive page served next to the OpenAPI contract. */
  readonly docsUi: (typeof DOCS_UIS)[number];
  /** The platform whose pipeline files `init` installed. */
  readonly ci: (typeof CI_PLATFORMS)[number];
  /** How the caller is identified at the boundary. */
  readonly authn: (typeof AUTHN_STACKS)[number];
  /** The authorization model behind the `Authorizer` port. */
  readonly authz: (typeof AUTHZ_STACKS)[number];
  /** Where the outbox relay publishes: `none` is the in-memory bus of the same process. */
  readonly broker: (typeof BROKER_STACKS)[number];
  /** What backs the kernel `Cache` port, the relay signal, the rate limiter and the lock of the jobs: the process itself, or a Redis protocol server. */
  readonly cache: (typeof CACHE_STACKS)[number];
  /** Whether the audit trail is wired: decisions, commands and integration events, recorded from outside the use cases. */
  readonly audit: (typeof AUDIT_MODES)[number];
  /** Where unexpected errors are reported: nowhere, or a Sentry protocol server (Sentry, GlitchTip). */
  readonly errors: (typeof ERROR_REPORTERS)[number];
  /** What implements the kernel `Logger` port: JSON lines on the standard output, pino or winston. */
  readonly logger: (typeof LOGGERS)[number];
  /**
   * How a context is written: `declared`, each class says what it is with a decorator of
   * `@ddd-ts-kit/kernel/declarations` and there is no module file; `explicit`, every binding is
   * written in `<context>.module.ts`. A config that says nothing was written before the declared
   * style existed: it is explicit.
   */
  readonly style: (typeof STYLES)[number];
  /** How a declared context reaches the composition root: one generated barrel, or discovery of its role files at startup. */
  readonly assembly: (typeof ASSEMBLIES)[number];
}
