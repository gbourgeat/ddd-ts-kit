import type { SpecRules } from './rules-in';

/** The specs of one directory of tests, under a heading: the unit specs, the integration specs, the end-to-end specs. */
export interface PageSection {
  readonly title: string;
  readonly specs: readonly SpecOfPage[];
}

/** One spec of a page: where it is, from the directory the page reads, and what it states. */
export interface SpecOfPage {
  readonly file: string;
  readonly rules: SpecRules;
}
