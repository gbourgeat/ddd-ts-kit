import type { StatedContentRule } from './stated-content-rule';

/** How the content of a media type is verified: by the signature of its format, or as its route states. */
export type ContentRule = 'signature' | StatedContentRule;
