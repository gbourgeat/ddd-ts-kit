import { describe, expect, it } from 'vitest';
import type { ClientDocument } from '../src/sdk/client-document';
import { clientFiles } from '../src/sdk/client-files';
import { renderClient } from '../src/sdk/render-client';
import type { Rpc } from '../src/sdk/rpc';
import { readClientDocument } from '../src/sdk/read-client-document';
import { SchemaTypes } from '../src/sdk/schema-types';
import { CLASHING_CONTRACT } from './support/clashing-contract';
import { SHOP_CONTRACT } from './support/shop-contract';

const SHOP = readClientDocument({ name: 'api', source: 'openapi/openapi.yaml' }, SHOP_CONTRACT);

describe('the client of a contract whose title holds the end of a comment', () => {
  it('keeps the title inside the comment of the client', () => {
    const client = renderClient({ ...SHOP, title: 'x*/ globalThis.pwned = 1; /*' });

    expect(client).toContain('/** x*\\/ globalThis.pwned = 1; /* ');
    expect(client).not.toContain('x*/ globalThis');
  });
});

describe('reading a contract for its client', () => {
  it('names each operation from its id, its method and path without one, each name once', () => {
    expect(SHOP.operations.map((operation) => [operation.name, operation.method, operation.path])).toEqual([
      ['placeOrder', 'POST', '/orders'],
      ['getOrder', 'GET', '/orders/{orderId}'],
      ['cancelOrder', 'DELETE', '/orders/{orderId}'],
      ['getHealth', 'GET', '/health'],
    ]);
  });

  it('names apart an operation whose name is a reserved word, a name of the client, or the name of another', () => {
    const clashing = readClientDocument({ name: 'api', source: 'openapi/openapi.yaml' }, CLASHING_CONTRACT);

    expect(clashing.operations.map((operation) => operation.name)).toEqual([
      'deleteOperation',
      'defaultOperation',
      'newOperation',
      'send2',
      'createClient2',
      'unwrap2',
      'listItems',
      'ListItems2',
      'list_items2',
    ]);
  });

  it('reads the security of the operation, of the document otherwise, and only the schemes a client can send', () => {
    expect(SHOP.operations.map((operation) => operation.security)).toEqual([
      [['bearer', 'tenant']],
      [['bearer']],
      [['key'], []],
      [],
    ]);

    expect(Object.fromEntries(SHOP.schemes)).toEqual({
      bearer: { in: 'header', name: 'Authorization', prefix: 'Bearer ' },
      key: { in: 'query', name: 'api_key', prefix: '' },
      tenant: { in: 'cookie', name: 'tenant', prefix: '' },
    });
  });

  it('sends the token of OAuth 2 and of OpenID Connect as a bearer, and the scheme of HTTP as written', () => {
    const contract = {
      ...SHOP_CONTRACT,
      components: {
        ...SHOP_CONTRACT.components,
        securitySchemes: {
          oauth: { type: 'oauth2', flows: {} },
          oidc: { type: 'openIdConnect', openIdConnectUrl: 'https://id.example/.well-known' },
          basic: { type: 'http', scheme: 'basic' },
          digest: { type: 'http' },
        },
      },
    };

    const schemes = Object.fromEntries(
      readClientDocument({ name: 'api', source: 'openapi/openapi.yaml' }, contract).schemes,
    );

    expect(schemes).toEqual({
      oauth: { in: 'header', name: 'Authorization', prefix: 'Bearer ' },
      oidc: { in: 'header', name: 'Authorization', prefix: 'Bearer ' },
      basic: { in: 'header', name: 'Authorization', prefix: 'Basic ' },
      digest: { in: 'header', name: 'Authorization', prefix: 'Bearer ' },
    });
  });

  it('reads the parameters of the path item with those of the operation, a cookie left out', () => {
    const getOrder = SHOP.operations[1];

    expect(getOrder?.parameters.map((parameter) => [parameter.in, parameter.name, parameter.required])).toEqual([
      ['path', 'orderId', true],
      ['query', 'expand', false],
      ['header', 'X-Trace', false],
    ]);
  });

  it('reads the numeric statuses, their body and the error codes of a refusal', () => {
    expect(SHOP.operations[0]?.responses.map(({ status, read, codes }) => ({ status, read, codes }))).toEqual([
      { status: 201, read: 'json', codes: [] },
      { status: 409, read: 'json', codes: ['DUPLICATE', 'OUT_OF_STOCK'] },
    ]);

    expect(SHOP.operations[2]?.responses.map(({ status, read }) => [status, read])).toEqual([
      [204, 'none'],
      [401, 'none'],
    ]);

    expect(SHOP.operations[3]?.responses[0]?.read).toBe('text');
  });

  it('reads an empty or foreign document as a client without operation', () => {
    const empty = readClientDocument({ name: 'public', source: 'openapi/public.yaml' }, 'not a document');

    expect(empty).toMatchObject({ title: 'public', version: '0.0.0', operations: [], schemas: [], schemes: [] });
  });
});

describe('the types of a JSON Schema', () => {
  const types = new SchemaTypes('Schemas.');

  it('writes references, literals, unions, intersections and lists', () => {
    expect(types.typeOf({ $ref: '#/components/schemas/Line-Item' }, 0)).toBe('Schemas.Line_Item');
    expect(types.typeOf({ $ref: 'other.yaml#/X' }, 0)).toBe('unknown');
    expect(types.typeOf({ const: "it's" }, 0)).toBe("'it\\'s'");
    expect(types.typeOf({ enum: ['a', 1, null] }, 0)).toBe("'a' | 1 | null");
    expect(types.typeOf({ type: ['string', 'null'] }, 0)).toBe('string | null');
    expect(types.typeOf({ type: 'string', nullable: true }, 0)).toBe('string | null');

    expect(types.typeOf({ anyOf: [{ type: 'string' }, { type: 'array', items: { enum: ['x', 'y'] } }] }, 0)).toBe(
      "string | Array<'x' | 'y'>",
    );

    expect(types.typeOf({ allOf: [{ oneOf: [{ type: 'string' }, { type: 'number' }] }, { type: 'boolean' }] }, 0)).toBe(
      '(string | number) & boolean',
    );

    expect(types.typeOf({ oneOf: [] }, 0)).toBe('never');
    expect(types.typeOf(false, 0)).toBe('never');
    expect(types.typeOf({ type: 'whatever' }, 0)).toBe('unknown');
    expect(types.typeOf({}, 0)).toBe('unknown');
  });

  it('writes an object as a type literal, its optional properties those it does not require', () => {
    const order = {
      type: 'object',
      properties: { 'a-b': { type: 'integer', description: 'A */ b.' }, c: {} },
      required: ['c'],
    };

    expect(types.typeOf(order, 0)).toBe("{\n  /** A *\\/ b. */\n  'a-b'?: number;\n  c: unknown;\n}");
    expect(types.typeOf({ ...order, additionalProperties: true }, 1)).toContain('\n    [key: string]: unknown;\n  }');
    expect(types.typeOf({ type: 'object' }, 0)).toBe('Record<string, unknown>');

    expect(types.typeOf({ type: 'object', additionalProperties: { type: 'number' } }, 0)).toBe(
      'Record<string, number>',
    );

    expect(types.typeOf({ type: 'object', additionalProperties: false }, 0)).toBe('Record<string, never>');
  });
});

describe('the files of a client', () => {
  it('types each schema, a name that would hide a type of the file renamed', () => {
    expect(file('src/schemas.ts')).toContain('export type Line_Item = {\n  sku: string;\n  quantity?: number;\n};');
    expect(file('src/schemas.ts')).toContain('/** An order. */\nexport type Order = {\n  lines: Array<Line_Item>;');
    expect(file('src/schemas.ts')).toContain('export type Array_ = string;');
  });

  it('types the input and the outcome of each operation, a refusal by its codes', () => {
    const operations = file('src/operations.ts');

    expect(operations).toContain(
      "export type PlaceOrderResult =\n  | Success<201, {\n    id: string;\n  }>\n  | Failure<409, 'DUPLICATE' | 'OUT_OF_STOCK', Schemas.Problem>;",
    );

    expect(operations).toContain(
      'export interface GetOrderInput {\n  readonly path: {\n    readonly orderId: string;\n  };\n  readonly query?: {\n    /** What to include. */\n    readonly expand?: Array<string>;\n  };',
    );

    expect(operations).toContain(
      'export type CancelOrderResult =\n  | Success<204, undefined>\n  | Failure<401, string, undefined>;',
    );

    expect(operations).toContain('export type GetHealthInput = Record<string, never>;');
    expect(operations).toContain('@deprecated The contract marks it deprecated.');
    expect(operations).toContain("    security: [['key'], []],\n    responses: { 204: 'none', 401: 'none' },");
  });

  it('lists the error codes of the contract, and the schemes credentials are given for', () => {
    expect(file('src/errors.ts')).toContain(
      "export const ERROR_CODES = [\n  'DUPLICATE',\n  'ORDER_NOT_FOUND',\n  'OUT_OF_STOCK',\n] as const;",
    );

    expect(file('src/client.ts')).toContain("export type SchemeName = 'bearer' | 'key' | 'tenant';");
    expect(file('src/client.ts')).toContain('  getHealth(input?: operations.GetHealthInput, options?: CallOptions)');
  });

  it('documents its use, its operations and its codes in its README', () => {
    const readme = file('README.md');

    expect(readme).toContain("import { createClient, unwrap, isProblem } from 'shop-api-client';");
    expect(readme).toContain('credentials: { bearer: () => session.token() },');
    expect(readme).toContain('| `placeOrder` | `POST /orders` | DUPLICATE, OUT_OF_STOCK |');
    expect(readme).toContain('npm publish --workspace clients/api');
  });
});

describe('the oRPC contract of a client, when the API serves procedures', () => {
  const UPLOADING = readClientDocument(
    { name: 'api', source: 'openapi/openapi.yaml' },
    {
      ...SHOP_CONTRACT,
      paths: {
        ...SHOP_CONTRACT.paths,
        '/orders/{orderId}/receipt': {
          post: {
            operationId: 'attachReceipt',
            requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object' } } } },
            responses: { '204': { description: 'Attached.' } },
          },
        },
      },
    },
  );

  it('is written only when stack.rpc is orpc', () => {
    expect(file('src/orpc.ts')).toBe('');
    expect(file('src/orpc.ts', 'orpc')).toContain('export const contract = {');
  });

  it('names each procedure by the operationId of its route, quoted when it is not an identifier', () => {
    const orpc = file('src/orpc.ts', 'orpc');

    expect(orpc).toContain('  placeOrder: oc\n');
    expect(orpc).toContain("  'cancel order': oc\n");
  });

  it('types the input and the body as the HTTP client does, the refusals by code with their status', () => {
    const orpc = file('src/orpc.ts', 'orpc');

    expect(orpc).toContain(
      [
        '    .errors({',
        '      DUPLICATE: { status: 409, data: type<Problem>() },',
        '      OUT_OF_STOCK: { status: 409, data: type<Problem>() },',
        '    })',
        '    .input(type<Operations.PlaceOrderInput>())',
        '    .output(type<DataOf<Operations.PlaceOrderResult>>()),',
      ].join('\n'),
    );

    expect(orpc).toContain('type Problem = Schemas.Problem;');
  });

  it('leaves out an operation that receives a body other than JSON, and one that has no operationId', () => {
    const orpc = filesOf(UPLOADING, 'orpc').get('src/orpc.ts') ?? '';

    expect(orpc).not.toContain('attachReceipt');
    expect(orpc).not.toContain('getHealth');
    expect(UPLOADING.operations.find(({ name }) => name === 'attachReceipt')?.procedure).toBeUndefined();
  });

  it('says in the README how to call the procedures, and what stays with the HTTP client', () => {
    const readme = file('README.md', 'orpc');

    expect(readme).toContain("import { createRpcClient } from 'shop-api-client/orpc';");
    expect(readme).toContain('await safe(rpc.placeOrder({ ... }))');
    expect(readme).toContain('those that receive a file or a raw body: `getHealth`');
    expect(file('README.md')).not.toContain('## Procedures (oRPC)');
  });
});

describe('the tRPC router type of a client, when the API serves procedures', () => {
  it('is written only when stack.rpc is trpc, and the oRPC contract is not', () => {
    expect(file('src/trpc.ts')).toBe('');
    expect(file('src/trpc.ts', 'trpc')).toContain('export type AppRouter = TRPCBuiltRouter<');
    expect(file('src/orpc.ts', 'trpc')).toBe('');
  });

  it('types each procedure as a query for a GET and a mutation otherwise, its input and body as the HTTP client does', () => {
    const trpc = file('src/trpc.ts', 'trpc');

    expect(trpc).toContain(
      '    placeOrder: TRPCMutationProcedure<Procedure<Operations.PlaceOrderInput, DataOf<Operations.PlaceOrderResult>>>;',
    );

    expect(trpc).toMatch(/ {4}getOrder: TRPCQueryProcedure<Procedure<Operations\.GetOrderInput, /);
    expect(trpc).toContain("    'cancel order': TRPCMutationProcedure<");
    expect(trpc).toContain('readonly problem: Problem | null;');
    expect(trpc).not.toContain('getHealth');
  });

  it('says in the README how to call the procedures, and where the code of a refusal is', () => {
    const readme = file('README.md', 'trpc');

    expect(readme).toContain("import { createRpcClient, isRpcRefusal } from 'shop-api-client/trpc';");
    expect(readme).toContain('await trpc.placeOrder.mutate({ ... });');
    expect(readme).toContain('`data.problem` the problem document');
    expect(readme).not.toContain('## Procedures (oRPC)');
  });
});

function file(name: string, rpc: Rpc = 'none'): string {
  return filesOf(SHOP, rpc).get(name) ?? '';
}

function filesOf(document: ClientDocument, rpc: Rpc): Map<string, string> {
  return new Map(clientFiles({ document, packageName: 'shop-api-client', directory: 'clients/api' }, rpc));
}
