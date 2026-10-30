import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineRoute } from '../src';
import { generateOpenApi } from '../src/openapi';
import { openApiOptions } from './support/open-api-options';
import { orderRoutes } from './support/orders';

const document = generateOpenApi(openApiOptions(orderRoutes));
const operation = (path: string, method: string) => document.paths[path]?.[method];

describe('generateOpenApi', () => {
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
          headers: {
            'Cache-Control': {
              description: 'How the caches on the way may keep this answer.',
              schema: { type: 'string', const: 'no-store' },
            },
          },
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
});

describe('the operations of a generated contract', () => {
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

  it('writes no parameter for a query schema that lists no property', () => {
    const search = defineRoute(
      {
        method: 'GET',
        path: '/search',
        operationId: 'search',
        summary: 'Search by any field',
        request: { query: zodSchema(z.record(z.string(), z.string())) },
        responses: { 204: { description: 'Searched.' } },
        security: false,
      },
      () => ({ status: 204 }),
    );

    const written = generateOpenApi(openApiOptions([search])).paths['/search']?.['get'];

    expect(written?.['parameters'] ?? []).toEqual([]);
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
});
