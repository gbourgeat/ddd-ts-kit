import { context, trace, type Context, type Span } from '@opentelemetry/api';
import { tracingConfiguration } from './config.js';

export const DROPPED_SPANS_ATTRIBUTE = 'app.dependency_spans.dropped';

interface LocalRoot {
  readonly span: Span;
  readonly perName: Map<string, number>;
  total: number;
  dropped: number;
}

// Keyed by span object: the SDK hands the same object to the processor and to the
// context, and a WeakMap needs no cleanup when a trace ends.
const roots = new WeakMap<Span, LocalRoot>();

/**
 * Span processor that remembers, for every span, the local root it belongs to (the
 * first span of the trace in this process: no parent, or a remote one). Add it to the
 * tracer provider to enable the per-root cap of dependency spans; without it the cap is
 * not applied. Structurally compatible with the SDK `SpanProcessor`.
 */
export class LocalRootTracker {
  onStart(span: Span, parentContext: Context): void {
    const parent = trace.getSpan(parentContext);
    const inherited = parent === undefined ? undefined : roots.get(parent);
    roots.set(span, inherited ?? { span, perName: new Map(), total: 0, dropped: 0 });
  }

  onEnd(): void {}

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}
}

/**
 * Counts one more dependency span under the active local root, or refuses it once a cap
 * is reached. A loop of a thousand repository calls must not become a thousand spans.
 */
export function admitDependencySpan(name: string): boolean {
  const active = trace.getSpan(context.active());
  const root = active === undefined ? undefined : roots.get(active);
  if (root === undefined) return true;

  const { maxSpansPerName, maxSpansPerRoot } = tracingConfiguration();
  const sameName = root.perName.get(name) ?? 0;
  if (root.total >= maxSpansPerRoot || sameName >= maxSpansPerName) {
    root.dropped += 1;
    if (root.span.isRecording()) root.span.setAttribute(DROPPED_SPANS_ATTRIBUTE, root.dropped);
    return false;
  }
  root.perName.set(name, sameName + 1);
  root.total += 1;
  return true;
}
