import { trace, type SpanContext } from '@opentelemetry/api';
import type { ErrorReporter } from '@ddd-ts-kit/kernel';
import { defineRoute, executeRoute, reportHttpErrors } from '@ddd-ts-kit/http';
import { withSpan } from '@ddd-ts-kit/tracing';

export interface FailedRequest {
  readonly status: number;
  /** The span the request ran in, as the kit's tracer made it. */
  readonly span: SpanContext | undefined;
}

const shipOrder = defineRoute(
  { method: 'POST', path: '/orders/ship', operationId: 'shipOrder', summary: 'Ships', security: false, responses: { 204: { description: 'Shipped' } } },
  () => {
    throw new Error('connection reset');
  },
);

/** One request through the route pipeline, inside a span of the kit, answered 500 and reported. */
export async function failingRequest(errors: ErrorReporter): Promise<FailedRequest> {
  return withSpan('POST /orders/ship', async () => {
    const span = trace.getActiveSpan()?.spanContext();

    const response = await executeRoute(
      shipOrder,
      { params: {}, query: {}, headers: { 'x-correlation-id': 'corr-1' }, body: undefined, raw: undefined },
      { onError: reportHttpErrors(errors) },
    );

    return { status: response.status, span };
  });
}
