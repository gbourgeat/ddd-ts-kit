import type { Span } from '@opentelemetry/api';

/** The first span of a trace in this process, and what was counted under it. */
export interface LocalRoot {
  readonly span: Span;
  readonly perName: Map<string, number>;
  total: number;
  dropped: number;
  /** Whether the span already names the execution context it belongs to. */
  correlated: boolean;
}
