/** One span of a trace as plain data, with the spans it is the parent of in the order they started. */
export interface SpanNode {
  readonly name: string;
  readonly kind: 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';
  readonly status: 'UNSET' | 'OK' | 'ERROR';
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly traceId: string;
  readonly spanId: string;
  /** The trace ids the span links to. */
  readonly links: readonly string[];
  readonly children: readonly SpanNode[];
}
