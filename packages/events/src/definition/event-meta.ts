export interface EventMeta {
  readonly id: string;
  readonly occurredAt: Date | string;
  readonly correlationId?: string;
  readonly traceparent?: string;
}
