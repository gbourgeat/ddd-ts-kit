import type { StatedContentRule } from './stated-content-rule';

/** The content rules a route states, by exact media type or by family (`video/*`): the exact one wins. */
export type ContentRules = Readonly<Record<string, StatedContentRule>>;
