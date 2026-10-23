import { createErrorMapper, type Route } from '../../src';
import type { GenerateOpenApiOptions } from '../../src/openapi';

export const openApiOptions = (routes: readonly Route[]): GenerateOpenApiOptions => ({
  info: { title: 'Orders', version: '1.2.0', description: 'Ordering context.' },
  servers: [{ url: 'https://api.example.com' }],
  routes,
  securitySchemes: {
    bearer: { type: 'http', scheme: 'bearer' },
    apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
  },
  errorMapper: createErrorMapper({ ORDER_ALREADY_SHIPPED: 409 }),
});
