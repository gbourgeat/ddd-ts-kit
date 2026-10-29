/** A header name as HTTP writes it (a token), and a value with no line break nor control character in it. */
const NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const VALUE = /^[\t\x20-\x7e\x80-\xff]*$/;

/** What described the body of the error, not the problem written in its place. */
const OF_THE_BODY = new Set(['content-type', 'content-length', 'content-encoding', 'transfer-encoding']);

/**
 * The headers a refusal carries for its client, by lower-case name: `headers` of an error of
 * http-errors (Express, Nest over Express) or of Fastify, the headers of the response a Hono
 * `HTTPException` holds (`res`). A 401 keeps its `WWW-Authenticate`, a 405 its `Allow`, a 429 or a
 * 503 its `Retry-After`. A value that is not a text or a number is left out, and so is a header no
 * response could write.
 */
export function refusalHeaders(error: unknown): Record<string, string> {
  const kept: Record<string, string> = {};

  for (const [name, value] of carried(error)) {
    const lowered = name.toLowerCase();

    if (NAME.test(name) && VALUE.test(value) && !OF_THE_BODY.has(lowered)) {
      kept[lowered] = value;
    }
  }

  return kept;
}

function carried(error: unknown): Array<readonly [string, string]> {
  const response = valueAt(error, 'res');

  if (response instanceof Response) {
    return [...response.headers.entries()];
  }

  const headers = valueAt(error, 'headers');

  if (typeof headers !== 'object' || headers === null) {
    return [];
  }

  return Object.entries(headers).flatMap(([name, value]: [string, unknown]) =>
    typeof value === 'string' || typeof value === 'number' ? [[name, String(value)] as const] : [],
  );
}

function valueAt(error: unknown, key: string): unknown {
  return typeof error === 'object' && error !== null ? Reflect.get(error, key) : undefined;
}
