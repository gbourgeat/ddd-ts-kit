import type { JsonSchema } from '@ddd-ts-kit/validation';
import type { Route } from '../route/route';
import type { UploadSpec } from '../route/upload-spec';
import type { Documenting } from './documenting';

/**
 * The request body of an operation: JSON and, under negotiation, every media type the route reads it in besides, or
 * for an upload the multipart form with its file, its size and its media types.
 */
export function requestBody(route: Route, { definitions, representations }: Documenting): JsonSchema | undefined {
  const body = route.request?.body;
  const fields = body === undefined ? undefined : definitions.embed(body);

  if (route.upload !== undefined) {
    return multipartBody(route.upload, fields);
  }

  if (route.rawBody === true) {
    return rawBody();
  }

  if (fields === undefined) {
    return undefined;
  }

  const mediaTypes = ['application/json', ...(representations === undefined ? [] : (route.consumes ?? []))];

  return {
    required: true,
    content: Object.fromEntries(mediaTypes.map((mediaType) => [mediaType, { schema: fields }])),
  };
}

/** The bytes as they arrive: no schema, nothing validates them before the handler. */
function rawBody(): JsonSchema {
  return {
    required: true,
    description:
      'The body as it is sent, not parsed and not validated by the server: the route checks it itself, for example a signature over its bytes.',
    content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
  };
}

function multipartBody(upload: UploadSpec, fields: JsonSchema | undefined): JsonSchema {
  const types = upload.mediaTypes.join(', ');

  const file = {
    type: 'object',
    properties: {
      [upload.field]: {
        type: 'string',
        contentMediaType: 'application/octet-stream',
        description: `The file: ${types}, at most ${String(upload.maxBytes)} bytes, its type checked on its content.`,
        'x-max-bytes': upload.maxBytes,
        'x-media-types': [...upload.mediaTypes],
      },
    },
    required: [upload.field],
  };

  return {
    required: true,
    description: 'Text fields first, then the file: a field sent after the file is not read.',
    content: {
      'multipart/form-data': {
        schema: fields === undefined ? file : { allOf: [fields, file] },
        encoding: { [upload.field]: { contentType: types } },
      },
    },
  };
}
