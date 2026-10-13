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
  /**
   * The tenant the fact belongs to, stamped from the work that published it. A consumer handles
   * the event in that tenant's scope, so its reads and writes stay in the tenant. Absent for a
   * fact of no tenant (the platform's own).
   */
  readonly tenantId?: string;
}
