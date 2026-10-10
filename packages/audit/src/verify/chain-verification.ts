import type { ChainBreak } from './chain-break.js';

export type ChainVerification =
  | { readonly valid: true; readonly checked: number }
  | { readonly valid: false; readonly checked: number; readonly break: ChainBreak };
