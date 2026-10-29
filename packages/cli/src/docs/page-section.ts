import type { SpecRules, StatedRule } from './rules-in';
import type { SpecSubject } from './spec-subject';

/** A part of a page under a heading of its own: the use cases, the model, the reactions, a directory of specs. */
export interface PageSection {
  readonly title: string;
  readonly entries: readonly PageEntry[];
}

/** One heading of a section, a use case, a part of the model or one spec, and the specs that state its rules. */
export interface PageEntry {
  readonly heading: string;
  readonly specs: readonly SpecOfPage[];
}

/**
 * One spec of a page: where it is, from the directory the page reads (`test/e2e/...` for a spec of
 * the application), what it states, what it is about and which of its rules a template of the kit
 * wrote, read once when the spec is read.
 */
export interface SpecOfPage {
  readonly file: string;
  readonly rules: SpecRules;
  readonly subject: SpecSubject;
  readonly generated: ReadonlySet<StatedRule>;
  /** What the list of specs of a heading says of it: `shared with Refund invoice`, `listed under Cancel invoice`. */
  readonly note?: string;
}
