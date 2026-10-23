import type { Layer } from './layer';

export interface ContextLocation {
  readonly area: 'context';
  readonly context: string;
  readonly layer: Layer;
  readonly inside: readonly string[];
  /** The module of the model the file belongs to, its folder level already left out of `inside`. */
  readonly module?: string;
}

export type Location = ContextLocation | { readonly area: 'shared-kernel' | 'platform' | 'main' | 'other' };
