import type { RenderContext } from '../../templating';
import { named } from '../named';
import type { Birth } from './birth';
import { instantOf } from './instant-of';

/**
 * What the templates of an aggregate, its builder and its spec read of its birth: `{{#if birth.named}}`,
 * the event `{{birth.pascal}}` and the instant `{{birth.instant}}`, named after the fact (`issuedAt`).
 */
export function birthVars(birth: Birth | undefined): RenderContext {
  return birth === undefined
    ? { named: false }
    : { ...named(birth.event), named: true, instant: instantOf(birth.fact) };
}
