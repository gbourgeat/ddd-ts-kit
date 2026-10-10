import { SpanKind, SpanStatusCode, context, trace, type Span } from '@opentelemetry/api';
import { CORRELATION_ID_ATTRIBUTE, ORIGIN_ATTRIBUTE } from '../local-root/correlate.js';
import { localRoots } from '../local-root/local-roots.js';
import { markSpanFailed } from '../span/mark-span-failed.js';
import { OUTCOME_ATTRIBUTE } from '../span/outcome-attribute.js';
import { refusalCode } from '../span/refusal-code.js';
import { tracer } from '../span/tracer.js';
import { isNoiseRoute } from './is-noise-route.js';

/** The route a request was matched to, as the HTTP pipeline of the kit describes it. */
export interface TracedRoute {
  readonly method: string;
  /** The template (`/orders/:id`), never the URL that was called. */
  readonly path: string;
  readonly operationId: string;
}

/** What the pipeline answered. */
export interface TracedResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

export interface TracedRoutesOptions {
  /** Routes that get no span of their own. Defaults to health, readiness, metrics and documentation routes. */
  readonly ignore?: (route: TracedRoute) => boolean;
}

type Around = <R extends TracedResponse>(route: TracedRoute, respond: () => Promise<R>) => Promise<R>;

/**
 * The `around` hook of `@ddd-ts-kit/http` (`ExecuteOptions`): the SERVER span of each request,
 * named by method and route template, `POST /orders/:id/lines`, never by the URL. The span an
 * HTTP instrumentation already opened for the request is renamed and completed; without one,
 * the span is started here. It says the operation, the status, the correlation id, and for a
 * refusal the code of the problem answered: a 4xx is an answer, a 5xx an error.
 */
export function tracedRoutes(options: TracedRoutesOptions = {}): Around {
  const ignored = options.ignore ?? isNoiseRoute;

  return async (route, respond) => {
    if (ignored(route)) {
      return respond();
    }

    const existing = serverSpanInProgress();
    const span = existing ?? started(route);

    span.updateName(`${route.method} ${route.path}`);
    span.setAttributes({ 'http.route': route.path, 'app.operation': route.operationId });

    try {
      const response = await context.with(trace.setSpan(context.active(), span), respond);

      answered(span, response);

      return response;
    } catch (error) {
      markSpanFailed(span, error);

      throw error;
    } finally {
      if (existing === undefined) {
        span.end();
      }
    }
  };
}

/** The active span when it is the local root and a SERVER span: the one an HTTP instrumentation opened for the request. */
function serverSpanInProgress(): Span | undefined {
  const active = trace.getActiveSpan();

  if (active === undefined || !active.isRecording() || localRoots.get(active)?.span !== active) {
    return undefined;
  }

  // The API of a span does not say its kind; the span of the SDK does.
  return Reflect.get(active, 'kind') === SpanKind.SERVER ? active : undefined;
}

function started(route: TracedRoute): Span {
  return tracer().startSpan(`${route.method} ${route.path}`, {
    kind: SpanKind.SERVER,
    attributes: { 'http.request.method': route.method },
  });
}

function answered(span: Span, { status, headers, body }: TracedResponse): void {
  const correlationId = headers['x-correlation-id'];

  span.setAttributes({
    'http.response.status_code': status,
    [ORIGIN_ATTRIBUTE]: 'http',
    ...(correlationId === undefined ? {} : { [CORRELATION_ID_ATTRIBUTE]: correlationId }),
    [OUTCOME_ATTRIBUTE]: outcomeOf(status),
    ...(status >= 400 ? refusalCode(body) : {}),
  });

  if (status >= 500) {
    span.setStatus({ code: SpanStatusCode.ERROR });
  }
}

function outcomeOf(status: number): string {
  if (status >= 500) {
    return 'failed';
  }

  return status >= 400 ? 'refused' : 'succeeded';
}
