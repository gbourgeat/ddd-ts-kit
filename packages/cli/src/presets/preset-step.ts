import type { Kind, KindFlags } from '../generate/kind.js';

/** One generator a preset runs on its context, as `ddd-ts-kit generate <kind> <context> <args...>` would. */
export interface PresetStep {
  readonly kind: Kind;
  readonly args: readonly string[];
  readonly flags?: Partial<KindFlags>;
}
