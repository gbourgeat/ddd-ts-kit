import type { SpecRules } from './rules-in';

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

/** One spec of a page: where it is, from the directory the page reads (`test/e2e/...` for a spec of the application), and what it states. */
export interface SpecOfPage {
  readonly file: string;
  readonly rules: SpecRules;
}
