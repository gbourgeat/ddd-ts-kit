import type { Span } from '@opentelemetry/api';
import type { LocalRoot } from './local-root.js';

// Keyed by span object: the SDK hands the same object to the processor and to the
// context, and a WeakMap needs no cleanup when a trace ends.
export const localRoots = new WeakMap<Span, LocalRoot>();
