import type { ContextLocation } from './context-location.js';

export type Location = ContextLocation | { readonly area: 'shared-kernel' | 'platform' | 'main' | 'other' };
