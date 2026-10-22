import { SpanKind, type Span } from '@opentelemetry/api';
import { isUnexpectedError, type BusMiddleware } from '@ddd-ts-kit/kernel';
import { inSpan } from '../span/in-span';
import { markSpanFailed } from '../span/mark-span-failed';
import { OUTCOME_ATTRIBUTE } from '../span/outcome-attribute';
import { refusalCode } from '../span/refusal-code';

/**
 * The bus middleware that makes one span per use case: `command PlaceOrder`, `query GetOrder`,
 * with the bounded context of the handler and the outcome. A business refusal (`DomainError`)
 * is an answer: the span says `refused` and the code, and is not an error. Anything else marks
 * it failed. Put it after the authorization and outside the unit of work, as `kernelModule`
 * does: a message refused by the guard never started, and the span covers the commit.
 */
export function traceUseCases(): BusMiddleware {
  return (_message, next, info) => {
    const attributes = {
      'app.use_case.kind': info.kind,
      'app.use_case.name': info.name,
      ...(info.context === undefined ? {} : { 'app.context': info.context }),
    };

    const start = {
      name: `${info.kind} ${info.name}`,
      options: { kind: SpanKind.INTERNAL, attributes },
      onFailure: refusedOrFailed,
    };

    return inSpan(start, async (span) => {
      const result = await next();

      span.setAttribute(OUTCOME_ATTRIBUTE, 'succeeded');

      return result;
    });
  };
}

function refusedOrFailed(span: Span, error: unknown): void {
  if (isUnexpectedError(error)) {
    markSpanFailed(span, error);
    span.setAttribute(OUTCOME_ATTRIBUTE, 'failed');

    return;
  }

  span.setAttributes({ [OUTCOME_ATTRIBUTE]: 'refused', ...refusalCode(error) });
}
