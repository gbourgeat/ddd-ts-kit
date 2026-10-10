import { traceDependency } from './trace-dependency.js';

export interface TraceUseCaseOptions {
  readonly context: string;
  readonly className?: string;
}

/** `traceDependency` for a command or query handler. */
export function traceUseCase<T extends object>(handler: T, options: TraceUseCaseOptions): T {
  return traceDependency(handler, { ...options, kind: 'use-case' });
}
