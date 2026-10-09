import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { customSchema } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { ok } from '@ddd-ts-kit/kernel';
import { DuplicateRouteError, createErrorMapper, defineRoute, type Route } from '../src/index.js';
import {
  checkOpenApiDrift,
  generateOpenApi,
  stringifyOpenApi,
  type GenerateOpenApiOptions,
} from '../src/openapi.js';
import { cancelOrder, getOrder, orderRoutes, placeOrder, whoAmI } from './support/orders.js';

const options = (routes: readonly Route[]): GenerateOpenApiOptions => ({
  info: { title: 'Orders', version: '1.2.0', description: 'Ordering context.' },
  servers: [{ url: 'https://api.example.com' }],
  routes,
  securitySchemes: {
    bearer: { type: 'http', scheme: 'bearer' },
    apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
  },
  errorMapper: createErrorMapper({ ORDER_ALREADY_SHIPPED: 409 }),
});

describe('generateOpenApi', () => {
  const document = generateOpenApi(options(orderRoutes));
  const operation = (path: string, method: string) => document.paths[path]?.[method];

  it('produces an OpenAPI 3.1.0 document with its header', () => {
    expect(document.openapi).toBe('3.1.0');
    expect(document.info).toEqual({ title: 'Orders', version: '1.2.0', description: 'Ordering context.' });
    expect(document.servers).toEqual([{ url: 'https://api.example.com' }]);
    expect(document.tags).toEqual([{ name: 'orders' }]);
  });

  it('writes paths in the {param} form, sorted', () => {
    expect(Object.keys(document.paths)).toEqual(['/me', '/orders', '/orders/{orderId}']);
    expect(Object.keys(document.paths['/orders/{orderId}'] ?? {})).toEqual(['get', 'delete']);
  });

  it('describes an operation with a request body', () => {
    expect(operation('/orders', 'post')).toEqual({
      operationId: 'placeOrder',
      summary: 'Place an order',
      tags: ['orders'],
      security: [{ bearer: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                customerId: { type: 'string', minLength: 1 },
                items: {
                  type: 'array',
                  minItems: 1,
                  items: {
                    type: 'object',
                    properties: {
                      sku: { type: 'string', minLength: 1 },
                      quantity: { type: 'integer', exclusiveMinimum: 0, maximum: 9007199254740991 },
                    },
                    required: ['sku', 'quantity'],
                  },
                },
              },
              required: ['customerId', 'items'],
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'The order was placed.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  customerId: { type: 'string' },
                  lines: { type: 'integer', minimum: -9007199254740991, maximum: 9007199254740991 },
                },
                required: ['id', 'customerId', 'lines'],
                additionalProperties: false,
              },
            },
          },
        },
        '409': {
          description: 'Conflict. Error codes: CONFLICT.',
          content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } },
          'x-error-codes': ['CONFLICT'],
        },
        '422': {
          description: 'Unprocessable Content. Error codes: VALIDATION_FAILED.',
          content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } },
          'x-error-codes': ['VALIDATION_FAILED'],
        },
      },
    });
  });

  it('turns params and query schemas into one parameter per property', () => {
    expect(operation('/orders/{orderId}', 'get')?.['parameters']).toEqual([
      {
        name: 'orderId',
        in: 'path',
        required: true,
        schema: expect.objectContaining({ type: 'string', format: 'uuid' }),
      },
      { name: 'expand', in: 'query', required: false, schema: { type: 'string', enum: ['lines'] } },
    ]);
  });

  it('lists the codes sharing a status in one problem response', () => {
    const responses = operation('/orders/{orderId}', 'get')?.['responses'];
    expect(Object.keys(responses ?? {})).toEqual(['200', '404', '409', '422']);
    expect(responses).toMatchObject({
      '404': { 'x-error-codes': ['NOT_FOUND'] },
      '409': {
        description: 'Conflict. Error codes: CONFLICT, ORDER_ALREADY_SHIPPED.',
        content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } },
        'x-error-codes': ['CONFLICT', 'ORDER_ALREADY_SHIPPED'],
      },
    });
  });

  it('adds 422 only to a route that validates its input', () => {
    expect(operation('/me', 'get')?.['responses']).not.toHaveProperty('422');
    expect(operation('/orders/{orderId}', 'delete')?.['responses']).toHaveProperty('422');
  });

  it('documents security on every route, a public one included, and the schemes in components', () => {
    expect(operation('/me', 'get')?.['security']).toEqual([{ bearer: [] }]);
    expect(operation('/orders/{orderId}', 'get')?.['security']).toEqual([]);
    expect(Object.keys(document.components.securitySchemes ?? {})).toEqual(['apiKey', 'bearer']);
  });

  it('shares one Problem schema', () => {
    expect(document.components.schemas['Problem']).toMatchObject({
      type: 'object',
      required: ['type', 'title', 'status', 'code', 'requestId'],
      properties: { issues: { type: 'array' } },
    });
  });

  it('describes a public, deprecated route with headers and an undescribed path parameter', () => {
    const legacy = defineRoute(
      {
        method: 'GET',
        path: '/legacy/:id',
        operationId: 'legacy',
        summary: 'Old endpoint',
        description: 'Kept for one more release.',
        deprecated: true,
        security: false,
        request: {
          headers: zodSchema(z.object({ 'x-tenant': z.string().describe('Tenant identifier.') })),
        },
        responses: { 200: { description: 'Anything.', body: customSchema((input) => ok(input)) } },
      },
      () => ({ status: 200, body: null }),
    );
    const generated = generateOpenApi({ ...options([legacy]), security: ['bearer'] });
    expect(generated.security).toEqual([{ bearer: [] }]);
    expect(generated.paths['/legacy/{id}']?.['get']).toMatchObject({
      description: 'Kept for one more release.',
      deprecated: true,
      security: [],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        {
          name: 'x-tenant',
          in: 'header',
          description: 'Tenant identifier.',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: { '200': { content: { 'application/json': { schema: {} } } } },
    });
  });

  it('moves local definitions to components and rewrites their references', () => {
    const address = z.object({ city: z.string() }).meta({ id: 'Address' });
    const other = z.object({ zip: z.string() }).meta({ id: 'Address' });
    const move = (operationId: string, path: string, body: z.ZodType) =>
      defineRoute(
        {
          method: 'PUT',
          path,
          operationId,
          summary: 'Move',
          request: { body: zodSchema(body) },
          responses: { 204: { description: 'Done.' } },
          security: ['bearer'],
        },
        () => ({ status: 204 }),
      );
    const generated = generateOpenApi(
      options([
        move('moveB', '/b', z.object({ to: address })),
        move('moveA', '/a', z.object({ from: address, to: address })),
        move('moveC', '/c', z.object({ to: other })),
      ]),
    );
    const text = stringifyOpenApi(generated);
    expect(text).not.toContain('$defs');
    expect(text).not.toContain('"$schema"');
    expect(Object.keys(generated.components.schemas)).toEqual(['Address', 'Address_2', 'Problem']);
    expect(generated.components.schemas['Address']).toMatchObject({ properties: { city: { type: 'string' } } });
    expect(generated.components.schemas['Address_2']).toMatchObject({ properties: { zip: { type: 'string' } } });
    expect(generated.paths['/b']?.['put']).toMatchObject({
      requestBody: {
        content: {
          'application/json': { schema: { properties: { to: { $ref: '#/components/schemas/Address' } } } },
        },
      },
    });
    expect(generated.paths['/c']?.['put']).toMatchObject({
      requestBody: {
        content: {
          'application/json': { schema: { properties: { to: { $ref: '#/components/schemas/Address_2' } } } },
        },
      },
    });
  });

  it('refuses duplicate routes like the adapters do', () => {
    expect(() => generateOpenApi(options([getOrder, getOrder]))).toThrow(DuplicateRouteError);
  });
});

describe('the committed contract', () => {
  it('is identical whatever the order the routes are given in', () => {
    const forwards = stringifyOpenApi(generateOpenApi(options([placeOrder, getOrder, cancelOrder, whoAmI])));
    const backwards = stringifyOpenApi(generateOpenApi(options([whoAmI, cancelOrder, getOrder, placeOrder])));
    expect(backwards).toBe(forwards);
    expect(stringifyOpenApi(generateOpenApi(options(orderRoutes)))).toBe(forwards);
  });

  it('is two-space JSON ending with a newline', () => {
    const text = stringifyOpenApi(generateOpenApi(options(orderRoutes)));
    expect(text.startsWith('{\n  "openapi": "3.1.0",\n  "info": {')).toBe(true);
    expect(text.endsWith('}\n')).toBe(true);
    expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(generateOpenApi(options(orderRoutes)))));
  });

  it('reports no drift against its own output, whatever the line endings', () => {
    const document = generateOpenApi(options(orderRoutes));
    const committed = stringifyOpenApi(document);
    expect(checkOpenApiDrift(document, committed)).toEqual({ drift: false });
    expect(checkOpenApiDrift(document, committed.replaceAll('\n', '\r\n'))).toEqual({ drift: false });
  });

  it('reports a drift when a route changed since the contract was committed', () => {
    const committed = stringifyOpenApi(generateOpenApi(options(orderRoutes)));
    const changed = generateOpenApi(options([placeOrder, getOrder, whoAmI]));
    expect(checkOpenApiDrift(changed, committed)).toEqual({ drift: true });
    expect(checkOpenApiDrift(changed, '')).toEqual({ drift: true });
  });
});
