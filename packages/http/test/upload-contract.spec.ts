import { describe, expect, it } from 'vitest';
import { InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import { generateOpenApi } from '../src/openapi';
import { openApiOptions } from './support/open-api-options';
import { UPLOAD, uploadRoutes } from './support/upload-desk';

const document = generateOpenApi(openApiOptions(uploadRoutes(new InMemoryFileStorage())));
const operation = document.paths['/documents']?.['post'];

describe('the contract of a route that declares an upload', () => {
  it('describes a multipart form: the text fields, then the file with its size and its media types', () => {
    expect(operation).toMatchObject({
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            encoding: { document: { contentType: 'application/pdf, text/*' } },
            schema: {
              allOf: [
                expect.anything(),
                {
                  required: ['document'],
                  properties: {
                    document: {
                      type: 'string',
                      contentMediaType: 'application/octet-stream',
                      'x-max-bytes': UPLOAD.maxBytes,
                      'x-media-types': ['application/pdf', 'text/*'],
                    },
                  },
                },
              ],
            },
          },
        },
      },
    });
  });

  it('documents the refusals of an upload: too large, another media type, a missing file', () => {
    expect(operation).toMatchObject({
      responses: {
        '413': { 'x-error-codes': ['FILE_TOO_LARGE'] },
        '415': { 'x-error-codes': ['UNSUPPORTED_MEDIA_TYPE'] },
        '422': { 'x-error-codes': ['VALIDATION_FAILED'] },
      },
    });
  });
});
