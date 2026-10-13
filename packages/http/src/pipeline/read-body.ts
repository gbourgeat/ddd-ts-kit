import type { Representations } from '../representation/representations.js';
import { isJsonMediaType } from '../representation/is-json-media-type.js';
import { mediaTypeOf } from '../representation/media-type-of.js';
import { UnsupportedMediaTypeError } from '../representation/unsupported-media-type-error.js';
import type { Route } from '../route/route.js';
import { jsonSchemaOf } from '../schema/json-schema-of.js';
import type { RawRequest } from './raw-request.js';

/**
 * The body of a request as the JSON path would have produced it, before its schema validates it:
 * a body sent as text in a media type the route consumes is read by its representation, and a
 * body in a media type the route does not read is refused with 415.
 */
export function readBody(route: Route, request: RawRequest, representations: Representations): RawRequest {
  const schema = route.request?.body;
  const mediaType = mediaTypeOf(request.headers['content-type']);

  if (schema === undefined || mediaType === undefined) {
    return request;
  }

  const reader = representations.readerOf(route, mediaType);

  if (reader?.read === undefined) {
    throw new UnsupportedMediaTypeError(`The route reads no body in ${mediaType}.`);
  }

  // A framework that already parsed the body (JSON) hands an object over: it is the value already.
  if (typeof request.body !== 'string') {
    assertUnparsed(request.body, mediaType);

    return request;
  }

  return { ...request, body: reader.read(request.body, { schema: jsonSchemaOf(schema), name: route.operationId }) };
}

/** Another parser than the representation's (a plugin, a middleware) read a body the representation must read: a defect of the setup. */
function assertUnparsed(body: unknown, mediaType: string): void {
  if (body !== undefined && !isJsonMediaType(mediaType)) {
    throw new Error(
      `A body in ${mediaType} reached the route already parsed: remove the body parser of ${mediaType}, the representation reads it.`,
    );
  }
}
