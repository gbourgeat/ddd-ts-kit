import type { Invocation } from './invocation.js';

export type Advice = (invocation: Invocation) => Promise<unknown>;
