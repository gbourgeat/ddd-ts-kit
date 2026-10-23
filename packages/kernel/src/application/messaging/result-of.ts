import type { RESULT } from './message-brands';

export type ResultOf<M> = M extends { readonly [RESULT]?: infer R } ? R : never;
