import type { ContextLocation } from './context-location';

export type Location = ContextLocation | { readonly area: 'shared-kernel' | 'platform' | 'main' | 'other' };
