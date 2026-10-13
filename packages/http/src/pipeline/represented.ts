import type { BodyShape } from '../representation/body-shape.js';
import type { Chosen } from '../representation/representations.js';
import type { RouteOutput } from '../route/route-output.js';
import type { Route } from '../route/route.js';
import { jsonSchemaOf } from '../schema/json-schema-of.js';
import { isAsyncIterable } from '../support/is-async-iterable.js';
import { primed } from './primed.js';
import type { RepresentedAnswer } from './represented-answer.js';
import { writtenAs } from './written-as.js';

/** The answer of a route in the media type the request negotiated. A binary body is the handler's own and is left as it is. */
export async function represented(route: Route, result: RouteOutput, chosen: Chosen): Promise<RepresentedAnswer> {
  const { body } = result;

  if (body === undefined) {
    return { headers: {} };
  }

  if (body instanceof Uint8Array) {
    return { headers: {}, body };
  }

  const schema = route.responses[result.status]?.body;
  const shape: BodyShape = { schema: schema === undefined ? {} : jsonSchemaOf(schema), name: route.operationId };

  return writtenAs(
    chosen.representation.write(isAsyncIterable(body) ? await primed(body) : body, shape),
    chosen.mediaType,
  );
}
