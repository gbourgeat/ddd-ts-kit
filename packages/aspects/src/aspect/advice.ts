import type { Invocation } from './invocation';

export type Advice = (invocation: Invocation) => Promise<unknown>;
