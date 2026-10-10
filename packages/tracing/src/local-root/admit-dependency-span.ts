import { context, trace } from '@opentelemetry/api';
import { tracingConfiguration } from '../configuration/configure-tracing.js';
import { correlate } from './correlate.js';
import { localRoots } from './local-roots.js';

export const DROPPED_SPANS_ATTRIBUTE = 'app.dependency_spans.dropped';

/**
 * Counts one more dependency span under the active local root, or refuses it once a cap
 * is reached. A loop of a thousand repository calls must not become a thousand spans.
 */
export function admitDependencySpan(name: string): boolean {
  const active = trace.getSpan(context.active());
  const root = active === undefined ? undefined : localRoots.get(active);

  if (root === undefined) return true;

  correlate(root);

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
