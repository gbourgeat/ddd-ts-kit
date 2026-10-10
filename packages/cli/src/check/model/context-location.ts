import type { Layer } from './layer.js';

/** A place inside a bounded context: its layer and the path below it. */
export interface ContextLocation {
  readonly area: 'context';
  readonly context: string;
  readonly layer: Layer;
  readonly inside: readonly string[];
}
