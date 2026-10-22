import { trace, type Context, type Span } from '@opentelemetry/api';
import { correlate } from './correlate';
import { localRoots } from './local-roots';

/**
 * Span processor that remembers, for every span, the local root it belongs to (the
 * first span of the trace in this process: no parent, or a remote one). Add it to the
 * tracer provider to enable the per-root cap of dependency spans; without it the cap is
 * not applied. Structurally compatible with the SDK `SpanProcessor`.
 *
 * With `configureTracing({ executionScope })`, it also names the correlation id and the origin
 * of the work on the local root, as soon as a span starts inside the execution scope: the root
 * itself usually starts before the boundary opened the scope.
 */
export class LocalRootTracker {
  onStart(span: Span, parentContext: Context): void {
    const parent = trace.getSpan(parentContext);
    const inherited = parent === undefined ? undefined : localRoots.get(parent);
    const root = inherited ?? { span, perName: new Map(), total: 0, dropped: 0, correlated: false };

    localRoots.set(span, root);
    correlate(root);
  }

  onEnd(): void {}

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}
}
