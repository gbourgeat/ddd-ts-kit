import type { PlannedFactory } from './planned-factory';

/** What `error-factories --plan` proposes and `--apply` follows: per context, where each class per error goes. */
export interface MigrationPlan {
  readonly contexts: Readonly<Record<string, readonly PlannedFactory[]>>;
}
