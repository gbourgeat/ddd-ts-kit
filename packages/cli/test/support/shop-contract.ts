const PROBLEM = { $ref: '#/components/schemas/Problem' };

const ORDERS = {
  post: {
    operationId: 'placeOrder',
    summary: 'Place order',
    security: [{ bearer: [], tenant: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } },
    },
    responses: {
      '201': {
        description: 'Placed.',
        content: {
          'application/json': { schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
        },
      },
      '409': refusal(['DUPLICATE', 'OUT_OF_STOCK']),
      default: { description: 'Anything else.' },
    },
  },
};

const ORDER = {
  parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
  get: {
    operationId: 'getOrder',
    summary: 'Get order',
    parameters: [
      {
        name: 'expand',
        in: 'query',
        description: 'What to include.',
        schema: { type: 'array', items: { type: 'string' } },
      },
      { name: 'X-Trace', in: 'header', schema: { type: 'string' } },
      { name: 'session', in: 'cookie', schema: { type: 'string' } },
    ],
    responses: {
      '200': {
        description: 'Found.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } },
      },
      '404': refusal(['ORDER_NOT_FOUND']),
    },
  },
  delete: {
    operationId: 'cancel order',
    deprecated: true,
    security: [{ key: [] }, {}],
    responses: { '204': { description: 'Cancelled.' }, '401': { description: 'Who are you?' } },
  },
};

/**
 * A contract that exercises what the client generator reads: parameters of a path item, a query
 * list, a header, a cookie it leaves out, a JSON body, problem documents with their codes, three
 * kinds of security schemes and alternatives, an operation without an id, a text answer.
 */
export const SHOP_CONTRACT = {
  openapi: '3.1.0',
  info: { title: 'shop', version: '1.2.0' },
  security: [{ bearer: [] }],
  paths: {
    '/orders': ORDERS,
    '/orders/{orderId}': ORDER,
    '/health': {
      get: {
        security: [],
        responses: { '200': { description: 'Alive.', content: { 'text/plain': { schema: { type: 'string' } } } } },
      },
    },
  },
  components: {
    schemas: {
      Order: {
        type: 'object',
        description: 'An order.',
        properties: {
          lines: { type: 'array', items: { $ref: '#/components/schemas/Line-Item' } },
          note: { type: ['string', 'null'] },
          status: { enum: ['open', 'paid'] },
        },
        required: ['lines'],
      },
      'Line-Item': {
        type: 'object',
        properties: { sku: { type: 'string' }, quantity: { type: 'integer' } },
        required: ['sku'],
      },
      Problem: {
        type: 'object',
        required: ['code', 'status'],
        properties: { code: { type: 'string' }, status: { type: 'integer' }, detail: { type: 'string' } },
      },
      Array: { type: 'string' },
    },
    securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      key: { type: 'apiKey', in: 'query', name: 'api_key' },
      tenant: { type: 'apiKey', in: 'cookie', name: 'tenant' },
      mutual: { type: 'mutualTLS' },
    },
  },
};

function refusal(codes: readonly string[]): Record<string, unknown> {
  return {
    description: `Refused: ${codes.join(', ')}.`,
    content: { 'application/problem+json': { schema: PROBLEM } },
    'x-error-codes': codes,
  };
}
