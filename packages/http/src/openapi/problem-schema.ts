import type { JsonSchema } from '@ddd-ts-kit/validation';

export const PROBLEM_SCHEMA: JsonSchema = {
  type: 'object',
  description: 'Problem details (RFC 9457) with a stable machine-readable code.',
  required: ['type', 'title', 'status', 'code', 'requestId'],
  properties: {
    type: { type: 'string', description: 'URI identifying the kind of problem.' },
    title: { type: 'string' },
    status: { type: 'integer' },
    code: { type: 'string', description: 'Stable error code; branch on this, not on the title.' },
    detail: { type: 'string' },
    issues: {
      type: 'array',
      description: 'Present when the request failed validation.',
      items: {
        type: 'object',
        required: ['path', 'code', 'message'],
        properties: {
          path: { type: 'string', description: 'Dotted path, for example body.items.0.sku.' },
          code: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
    requestId: { type: 'string' },
  },
};
