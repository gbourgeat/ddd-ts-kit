const BAD_REQUEST = 400;
const JSON_MEDIA = /[/+]json\b/i;
/** What both parsers say of a body that is not JSON, as Nest keeps it in the message of its own exception. */
const NAMES_JSON = /\bJSON\b/;

/**
 * Whether Nest refused a body its parser could not read as JSON. Nest wraps that error before any
 * filter sees it: over Express, the `SyntaxError` of body-parser in a `BadRequestException` of its
 * message; over Fastify, the error of its parser in an `HttpException` of its message and status.
 * Told by what is left: a 400 whose message names JSON, for a request in a JSON media type whose
 * body was never read. A refusal of a controller has a body read, and keeps its own code.
 */
export function isUnreadJsonBody(exception: unknown, request: unknown): boolean {
  const headers = valueAt(request, 'headers');
  const contentType = valueAt(headers, 'content-type');
  const message = valueAt(exception, 'message');

  return (
    valueAt(exception, 'status') === BAD_REQUEST &&
    typeof message === 'string' &&
    NAMES_JSON.test(message) &&
    typeof contentType === 'string' &&
    JSON_MEDIA.test(contentType) &&
    valueAt(request, 'body') === undefined
  );
}

function valueAt(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
}
