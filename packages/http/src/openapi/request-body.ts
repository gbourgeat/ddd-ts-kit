import type { JsonSchema } from '@ddd-ts-kit/validation';
import type { Route } from '../route/route.js';
import type { UploadSpec } from '../route/upload-spec.js';
import type { Definitions } from './definitions.js';

/** The request body of an operation: JSON, or for an upload the multipart form with its file, its size and its media types. */
export function requestBody(route: Route, definitions: Definitions): JsonSchema | undefined {
  const body = route.request?.body;
  const fields = body === undefined ? undefined : definitions.embed(body);

  if (route.upload !== undefined) {
    return multipartBody(route.upload, fields);
  }

  return fields === undefined ? undefined : { required: true, content: { 'application/json': { schema: fields } } };
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
