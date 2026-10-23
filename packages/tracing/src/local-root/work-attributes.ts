import type { Attributes } from '@opentelemetry/api';
import { tracingConfiguration } from '../configuration/configure-tracing';
import { CORRELATION_ID_ATTRIBUTE, ORIGIN_ATTRIBUTE } from './correlate';

/** The correlation id and the origin of the unit of work in progress, for the span that starts it. Empty outside of one. */
export function workAttributes(): Attributes {
  const execution = tracingConfiguration().executionScope?.current();

  if (execution === undefined) {
    return {};
  }

  return { [CORRELATION_ID_ATTRIBUTE]: execution.correlationId, [ORIGIN_ATTRIBUTE]: execution.origin };
}
