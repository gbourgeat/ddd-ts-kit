/**
 * The only thing that crosses a bounded-context boundary: a versioned, serializable,
 * backward-compatible contract owned by the producer (its published language).
 */
export interface IntegrationEvent<Payload = unknown> {
  readonly id: string;
  /** Routing key, `<context>.<aggregate>.<fact>`. */
  readonly type: string;
  /** Bumped on every breaking change of `payload`; old versions keep being served. */
  readonly version: number;
  readonly occurredAt: string;
  readonly payload: Payload;
  /** W3C traceparent captured at publication so consumers continue the same trace. */
  readonly traceparent?: string;
  readonly correlationId?: string;
}
