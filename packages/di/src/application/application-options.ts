import type { AuthorizationMode } from '../authorization/authorization-mode';
import type { JobsOptions } from '../jobs/jobs-options';
import type { ContextModule } from '../module/context-module';
import type { Decorate } from './decorate';
import type { Override } from './override';

export interface ApplicationOptions {
  readonly modules: readonly ContextModule[];
  readonly decorate?: Decorate;
  /** Values that replace bindings, typically fakes in tests. They are not decorated. */
  readonly overrides?: readonly Override[];
  /**
   * `required` refuses to create an application in which a command or a query declares neither
   * `.requires(permission)` nor `.public()`, or in which nothing checks them. Default `optional`.
   */
  readonly authorization?: AuthorizationMode;
  /** Whether this process runs the declared jobs by time, and what configuration changes of each. */
  readonly jobs?: JobsOptions;
}
