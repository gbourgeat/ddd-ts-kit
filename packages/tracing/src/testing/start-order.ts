import type { Span } from '@opentelemetry/api';

/** Span processor that remembers the order spans started in: start times alone can tie. */
export class StartOrder {
  private readonly positions = new Map<string, number>();

  onStart(span: Span): void {
    this.positions.set(span.spanContext().spanId, this.positions.size);
  }

  onEnd(): void {}

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}

  positionOf(spanId: string): number {
    return this.positions.get(spanId) ?? Number.MAX_SAFE_INTEGER;
  }

  clear(): void {
    this.positions.clear();
  }
}
