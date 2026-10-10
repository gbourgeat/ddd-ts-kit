import type { Layer } from './layer.js';

export interface ContextLocation {
  readonly area: 'context';
  readonly context: string;
  readonly layer: Layer;
  readonly inside: readonly string[];
}

export type Location = ContextLocation | { readonly area: 'shared-kernel' | 'platform' | 'main' | 'other' };
