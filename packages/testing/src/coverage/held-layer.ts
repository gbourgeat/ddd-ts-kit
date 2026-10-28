import type { CoverageLayer } from './coverage-layer';

/** A layer of one context that holds at least one source file: the unit a threshold is applied to. */
export interface HeldLayer {
  readonly context: string;
  readonly layer: CoverageLayer;
  /** Posix path of the layer directory from the root of the project. */
  readonly directory: string;
}
