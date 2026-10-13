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
export const DEPENDENCY_STATEMENTS = ['signature', 'listed'] as const;
export const REFUSAL_FORMS = ['factories', 'classes'] as const;
export const ROUTE_FORMS = ['controllers', 'functions'] as const;
export const VALUE_OBJECT_FORMS = ['throwing', 'result'] as const;
export const LITERAL_FORMS = ['named', 'free'] as const;
export const CACHE_STACKS = ['none', 'redis'] as const;
export const HTTP_CACHE_STACKS = ['none', 'varnish'] as const;
export const STORAGE_STACKS = ['none', 'local', 's3'] as const;
export const AUDIT_MODES = ['on', 'off'] as const;
export const ERROR_REPORTERS = ['none', 'sentry'] as const;
export const LOGGERS = ['stdout', 'pino', 'winston'] as const;
export const PACKAGE_MANAGERS = ['npm', 'pnpm'] as const;
export const QUEUE_STORES = ['memory', 'database', 'redis'] as const;
export const TENANCY_STRATEGIES = [
  'none',
  'shared-table',
  'row-level-security',
  'schema-per-tenant',
  'database-per-tenant',
] as const;

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
  /**
   * The shared HTTP cache in front of the API: `none`, or `varnish`, a service of the compose
   * file with its VCL, the answers tagged in `xkey` and the purge requests of the outbox handed to
   * `VarnishCachePurger`. A config that says nothing was written before the choice existed: `none`.
   */
  readonly httpCache: (typeof HTTP_CACHE_STACKS)[number];
  /**
   * Where the content of files lives, never in the database: `local`, a directory in development
   * and the memory in the tests; `s3`, a bucket of any provider of the S3 protocol (MinIO in the
   * compose stack); `none`, no file storage wired. A config that says nothing was written before
   * the choice existed: it is `none`.
   */
  readonly storage: (typeof STORAGE_STACKS)[number];
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
  /**
   * Where a declared class states what it depends on: `signature`, its constructor parameters and
   * nowhere else (the generated file of its context registers the list read from them);
   * `listed`, the last argument of its decorator. A config that says nothing was written when
   * every decorator listed its dependencies: it is `listed`, and both forms run in either.
   */
  readonly dependencies: (typeof DEPENDENCY_STATEMENTS)[number];
  /**
   * How a domain error is written: `factories`, one error class per concept of the model, each
   * refusal built by a static factory named in the words of the business
   * (`AppointmentError.slotTaken(..)`), which the `errors/*` rules hold; `classes`, one class per
   * error, built with `new`. A config that says nothing was written when every error was a
   * class: it is `classes`, and both forms run in either.
   */
  readonly refusals: (typeof REFUSAL_FORMS)[number];
  /**
   * How a route is written: `controllers`, one class per route decorated with `@Controller`,
   * under a folder of its own with its schemas, behind the guards of its `@RouteGroup`;
   * `functions`, one `defineRoute` function per route, listed in `<context>.routes.ts`. A config
   * that says nothing was written when every route was a function: it is `functions`, and both
   * forms run in either.
   */
  readonly routes: (typeof ROUTE_FORMS)[number];
  /**
   * How the factory of a value object refuses: `throwing`, `create` returns the value object or
   * throws the refusal built by the static factory of its concept, as the rest of the domain
   * refuses; `result`, `create` returns a `Result` of the kernel that the caller unwraps. A config
   * that says nothing was written when every value object returned a `Result`: it is `result`.
   */
  readonly valueObjects: (typeof VALUE_OBJECT_FORMS)[number];
  /**
   * How the code writes a closed value and a number: `named`, a value a closed vocabulary of the
   * project declares is read through it (`language/declared-vocabulary`) and a number of the
   * domain or the application has a name (`clean/no-magic-number`, ESLint); `free`, both rules
   * are silent. A config that says nothing was written before the rules existed: it is `free`.
   */
  readonly literals: (typeof LITERAL_FORMS)[number];
  /**
   * What installs the dependencies and runs the scripts: every command the CLI writes (scripts,
   * pipelines, hooks, Dockerfile, guidance) is in its dialect. A config that says nothing was
   * written before the choice existed: it is npm.
   */
  readonly packageManager: (typeof PACKAGE_MANAGERS)[number];
  /**
   * How the data of one tenant is kept from the others: `none`, one customer; `shared-table`, a
   * `tenant_id` column that every repository confines its statements to through the helpers of
   * the ORM package (`tenancy/scoped-statement` holds it). `row-level-security`,
   * `schema-per-tenant` and `database-per-tenant` are offered by the persistence packages and
   * read here, but `init` does not generate them yet. A config that says nothing was written
   * before the choice existed: it is `none`.
   */
  readonly tenancy: (typeof TENANCY_STRATEGIES)[number];
  /**
   * Where the background jobs and the instances of the process managers are kept: `database`,
   * the tables of the ORM package (Knex, Drizzle), written in the transaction of the command;
   * `redis`, `RedisJobStore` on the server of the cache, written once the command committed, the
   * process instances staying in the database or the memory; `memory`, in the process, which no
   * worker of another process sees. A config that says nothing was written before background jobs
   * existed: it is `memory`, the default of the kernel module.
   */
  readonly queue: (typeof QUEUE_STORES)[number];
}
