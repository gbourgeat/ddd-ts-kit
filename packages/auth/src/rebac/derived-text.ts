import type { DerivedRelation } from './derived-relation.js';
import type { Way } from './via.js';
import { waysOf } from './ways-of.js';

/** A derived relation in words: `any of: owner, editor, edit via parent; but not: banned`. */
export function derivedText(derived: DerivedRelation): string {
  const { anyOf, allOf, butNot } = waysOf(derived);

  return [
    ...(anyOf.length === 0 ? [] : [`any of: ${anyOf.map(wayText).join(', ')}`]),
    ...(allOf.length === 0 ? [] : [`all of: ${allOf.map(wayText).join(', ')}`]),
    ...(butNot.length === 0 ? [] : [`but not: ${butNot.map(wayText).join(', ')}`]),
  ].join('; ');
}

function wayText(way: Way): string {
  return typeof way === 'string' ? way : `${way.holds} via ${way.via}`;
}
