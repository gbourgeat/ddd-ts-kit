import type { ExecutionOrigin } from '../execution/execution-origin';

/**
 * What started the unit of work that failed: the origin of its execution context. Outside of
 * any, the capture point names itself: `command`, `query` or `process`.
 */
export type ErrorOrigin = ExecutionOrigin | 'command' | 'query' | 'process';
