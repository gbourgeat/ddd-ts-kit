import type { PlannedRefusal } from './planned-refusal.js';

/** What `error-factories --plan` proposes and `--apply` follows under `--to named`: per context, the class of each refusal. */
export interface NamedPlan {
  readonly to: 'named';
  readonly contexts: Readonly<Record<string, readonly PlannedRefusal[]>>;
}
