import type { ReconnectOptions } from './reconnect-options.js';

/** The delay before the given attempt, counted from 1: it grows by the factor up to the bound. */
export function reconnectDelay(reconnect: Required<ReconnectOptions>, attempt: number): number {
  return Math.min(reconnect.maxMs, reconnect.initialMs * reconnect.factor ** (attempt - 1));
}
