import type { Layer } from './layer';

export interface ContextLocation {
  readonly area: 'context';
  readonly context: string;
  readonly layer: Layer;
  readonly inside: readonly string[];
  /** The module of the model the file belongs to, its folder level already left out of `inside`. */
  readonly module?: string;
  /** In `shared/`, the one folder of what the modules of the context share, left out of `inside` too. */
  readonly shared?: boolean;
}

export type Location = ContextLocation | { readonly area: 'shared-kernel' | 'platform' | 'main' | 'other' };
