import type { ContentRules } from './content-rules';
import type { TextRule } from './text-rule';

/** What an incoming content must be: one of the accepted media types, the one it declares, verified on its bytes. */
export interface ContentExpectation {
  readonly mediaType: string;
  readonly accepted: readonly string[];
  /** The text a text type may be. Default `utf-8`. */
  readonly text?: TextRule;
  /** The rule of each accepted media type the kit has none for: without one, such a type never passes. */
  readonly contentRules?: ContentRules;
}
