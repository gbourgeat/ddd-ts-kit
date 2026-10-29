import type { ArgumentsHost, ExceptionFilter, HttpServer } from '@nestjs/common';
import { answeredEdgeError, type EdgeErrorOptions } from '../error/answered-edge-error';
import { MALFORMED_BODY } from '../error/edge-refusal';
import type { RawHeaders } from '../route/raw-headers';
import { isUnreadJsonBody } from './is-unread-json-body';

/** What the filter writes with: the HTTP adapter of the application, Express or Fastify (`app.getHttpAdapter()`). */
export type ProblemWriter = Pick<HttpServer, 'reply' | 'setHeader' | 'isHeadersSent' | 'end'>;

/**
 * A global exception filter: answers as a problem what reached Nest before a route of the kit
 * could, a body its parser refused (`MALFORMED_BODY` 400, `BODY_TOO_LARGE` 413), a path no route
 * serves (404 `NOT_FOUND`) or the error a middleware passed on, instead of the filter of Nest,
 * which answers `{ statusCode, message }`, a message that may quote the body, and logs the error.
 * The routes of the kit answer their own refusals: `app.useGlobalFilters(new
 * ProblemExceptionFilter(app.getHttpAdapter(), { logger }))`.
 */
export class ProblemExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly writer: ProblemWriter,
    private readonly options: EdgeErrorOptions = {},
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request: unknown = http.getRequest();
    const response: unknown = http.getResponse();
    const headers = headersOf(request);

    const edge = isUnreadJsonBody(exception, request)
      ? { error: exception, headers, refusal: MALFORMED_BODY }
      : { error: exception, headers };

    const answer = answeredEdgeError(edge, this.options);

    if (this.writer.isHeadersSent(response)) {
      // Too late for a problem: the client gets a response cut short, as for a failed stream.
      this.writer.end(response);

      return;
    }

    for (const [name, value] of Object.entries(answer.headers)) {
      this.writer.setHeader(response, name, value);
    }

    // Written as text, so that the adapter keeps the media type of a problem.
    this.writer.reply(response, JSON.stringify(answer.problem), answer.status);
  }
}

/** The headers of the request, as Express and Fastify both hold them. */
function headersOf(request: unknown): RawHeaders {
  const headers: unknown =
    typeof request === 'object' && request !== null ? Reflect.get(request, 'headers') : undefined;

  return typeof headers === 'object' && headers !== null ? { ...headers } : {};
}
