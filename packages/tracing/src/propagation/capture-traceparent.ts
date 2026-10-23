import { context } from '@opentelemetry/api';
import { traceparentFromContext } from './traceparent-from-context';

/** W3C `traceparent` of the active span, to store on an outgoing message. */
export function captureTraceparent(): string | undefined {
  return traceparentFromContext(context.active());
}
