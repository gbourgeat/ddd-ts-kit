import type { Way } from './via';
import type { Ways } from './ways';

/**
 * Who counts as what on an element, computed from the stored facts: a single way
 * (`'owner'`, `via('parent', 'edit')`), or several (`{ anyOf: [...], butNot: [...] }`).
 */
export type DerivedRelation = Way | Ways;
