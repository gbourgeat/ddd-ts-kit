import type { AdviceFactory } from './advice-factory.js';
import type { Aspect } from './aspect.js';

export type AspectOrigin = { readonly advise: AdviceFactory } | { readonly parts: readonly Aspect[] };

/** How each aspect of this package was made, so that `when` can select the methods of one. */
export const aspectOrigins = new WeakMap<Aspect, AspectOrigin>();
