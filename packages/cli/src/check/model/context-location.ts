import type { Layer } from './layer';

/** A place inside a bounded context: its layer and the path below it. */
export interface ContextLocation {
  readonly area: 'context';
  readonly context: string;
  readonly layer: Layer;
  readonly inside: readonly string[];
  /** The module of the context the file belongs to, its folder level already left out of `inside`. */
  readonly module?: string;
  /**
   * True for a file under `shared/` of a context divided into modules, the folder of what belongs
   * to none of them: its folder level is left out of `inside` as for a module, and it has no module.
   */
  readonly shared?: boolean;
}
