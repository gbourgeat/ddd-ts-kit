import type { Actor, EventBusFailures, ExecutionContext, Session } from '@ddd-ts-kit/kernel';
import type { Override } from '../application/override';
import type { AuthorizationMode } from '../authorization/authorization-mode';
import type { JobsOptions } from '../jobs/jobs-options';
import type { ContextModule } from '../module/context-module';

export interface TestApplicationOptions {
  /** The context modules under test. `kernelModule()` may be listed or left out. */
  readonly modules: readonly ContextModule[];
  /** Each must stand for a port that a module binds or that a class depends on. */
  readonly fakes?: readonly Override[];
  /** The instant the clock is frozen at. Default 2026-01-01T00:00:00.000Z. */
  readonly now?: Date;
  /** Prefix of the generated identifiers. Default `id`, giving `id-1`, `id-2`... */
  readonly idPrefix?: string;
  /**
   * Who infrastructure sees as the current actor. Default: the user `test-user`, without role.
   * Use cases never read it: a test passes the actor in the command or query.
   */
  readonly actor?: Actor;
  /**
   * The session infrastructure sees in the execution context. Its actor is the current actor:
   * give `session` or `actor`, the session wins.
   */
  readonly session?: Session;
  /**
   * The whole execution context infrastructure sees, for a spec about a tenant, a correlation,
   * a deadline or an origin. Its actor and session win over `actor` and `session`.
   */
  readonly executionContext?: ExecutionContext;
  /**
   * How `eventBus` rejects when its handlers fail: `as-thrown` rethrows the failure of a single
   * handler as it is. Default `aggregated`, which becomes `as-thrown` in a later minor version.
   */
  readonly eventBusFailures?: EventBusFailures;
  /** See `ApplicationOptions.authorization`. */
  readonly authorization?: AuthorizationMode;
  /** See `JobsOptions.settings`: what configuration changes of a declared job, by job name. */
  readonly jobs?: NonNullable<JobsOptions['settings']>;
  /**
   * The tenants a job declared `tenancy: 'per-tenant'` runs for, one run each. Default: the
   * tenant of the execution context; with neither, none: the application still composes (the
   * default scheduler would refuse such a job without a directory), and the job runs for no
   * tenant until a spec names one.
   */
  readonly tenants?: readonly string[];
}
