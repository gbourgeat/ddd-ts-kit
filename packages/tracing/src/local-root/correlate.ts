import { tracingConfiguration } from '../configuration/configure-tracing.js';
import type { LocalRoot } from './local-root.js';

export const CORRELATION_ID_ATTRIBUTE = 'app.correlation_id';
export const ORIGIN_ATTRIBUTE = 'app.origin';

/**
 * Names the execution context on the local root, once. Identifiers of the work only: who acts
 * and for which tenant never become span attributes.
 */
export function correlate(root: LocalRoot): void {
  if (root.correlated) {
    return;
  }

  const execution = tracingConfiguration().executionScope?.current();

  if (execution === undefined) {
    return;
  }

  root.correlated = true;

  if (!root.span.isRecording()) {
    return;
  }

  root.span.setAttribute(CORRELATION_ID_ATTRIBUTE, execution.correlationId);
  root.span.setAttribute(ORIGIN_ATTRIBUTE, execution.origin);
}
