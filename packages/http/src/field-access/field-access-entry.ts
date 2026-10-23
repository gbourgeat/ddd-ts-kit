import type { FieldRule } from './field-rule';

/** One restricted field, by its path from the root of a body: `*` stands for every item of a list. */
export interface FieldAccessEntry {
  readonly path: readonly string[];
  readonly rule: FieldRule;
}
