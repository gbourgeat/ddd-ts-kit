import type { Layer } from './layer';

/** A place inside a bounded context: its layer and the path below it. */
export interface ContextLocation {
  readonly area: 'context';
  readonly context: string;
  readonly layer: Layer;
  readonly inside: readonly string[];
  /** The module of the context the file belongs to, its folder level already left out of `inside`. */
  readonly module?: string;
}
