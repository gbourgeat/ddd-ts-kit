import type { Resolve } from '../wiring/resolve.js';

/** An instance, or a factory when it needs other bindings. A port is never itself a function. */
export type Provided<T> = T | ((resolve: Resolve) => T);
