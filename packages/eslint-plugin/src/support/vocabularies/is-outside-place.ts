import type { Location } from '../../project/location';

/** The folders of `infrastructure/` where a context meets a language that is not its own. */
const OUTSIDE = new Set(['anti-corruption', 'external']);

/** `infrastructure/anti-corruption/` and `infrastructure/external/` of a context: where an outside language is declared as it arrives. */
export function isOutsidePlace(location: Location): boolean {
  return location.area === 'context' && location.layer === 'infrastructure' && OUTSIDE.has(location.inside[0] ?? '');
}
