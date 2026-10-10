import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { customSchema } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { ok } from '@ddd-ts-kit/kernel';
import { DuplicateRouteError, defineRoute } from '../src/index.js';
import { checkOpenApiDrift, generateOpenApi, stringifyOpenApi } from '../src/openapi.js';
import { openApiOptions as options } from './support/open-api-options.js';
import { cancelOrder, getOrder, orderRoutes, placeOrder, whoAmI } from './support/orders.js';

describe('generateOpenApi, beyond the plain route', () => {
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
