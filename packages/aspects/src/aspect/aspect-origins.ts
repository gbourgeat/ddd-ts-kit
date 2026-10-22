import type { AdviceFactory } from './advice-factory';
import type { Aspect } from './aspect';

export type AspectOrigin = { readonly advise: AdviceFactory } | { readonly parts: readonly Aspect[] };

/** How each aspect of this package was made, so that `when` can select the methods of one. */
export const aspectOrigins = new WeakMap<Aspect, AspectOrigin>();
