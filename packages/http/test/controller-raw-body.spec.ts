import { describe, expect, it } from 'vitest';
import { generateOpenApi } from '../src/openapi';
import * as fixture from './fixtures/controllers/front-desk';
import { frontDeskRoutes, RecordingDesk } from './support/front-desk';

describe('a controller that declares a raw body', () => {
  it('states in the contract that the body is bytes the server does not validate', () => {
    const routes = frontDeskRoutes(fixture, new RecordingDesk());
    const document = generateOpenApi({ info: { title: 'Front desk', version: '1.0.0' }, routes });
    const alert = document.paths['/alerts']?.['post'];

    expect(alert?.['requestBody']).toMatchObject({
      required: true,
      content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
    });
  });
});
