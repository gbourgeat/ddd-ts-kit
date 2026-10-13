import type { JsonSchema } from '@ddd-ts-kit/validation';

const BLOCK = { $ref: '#/$defs/FormBlock' };

/** What the contract says of a form: JSON Forms, or the neutral tree of blocks. */
export const FORM_SCHEMA: JsonSchema = {
  oneOf: [
    {
      type: 'object',
      description: 'JSON Forms: give the three to a renderer for React, Angular or Vue.',
      required: ['schema', 'uischema', 'data'],
      properties: { schema: { type: 'object' }, uischema: { type: 'object' }, data: { type: 'object' } },
    },
    {
      type: 'object',
      description: 'The neutral tree of blocks, for a front end with its own rendering engine.',
      required: ['type', 'operation', 'method', 'path', 'label', 'blocks'],
      properties: {
        type: { const: 'form' },
        operation: { type: 'string' },
        method: { type: 'string' },
        path: { type: 'string' },
        label: { type: 'string', description: 'A translation key.' },
        blocks: { type: 'array', items: BLOCK },
      },
    },
  ],
  $defs: {
    FormBlock: {
      type: 'object',
      description:
        'A group (`type: group`, `blocks`) or a field (`type: field`, `widget`, `required`, `readOnly`, `constraints`, `options`, `lookup`, `visibleWhen`, `requiredWhen`, `value`). Labels are translation keys.',
      required: ['type', 'name', 'label'],
      properties: {
        type: { enum: ['group', 'field'] },
        name: { type: 'string' },
        label: { type: 'string' },
        widget: { type: 'string' },
        required: { type: 'boolean' },
        readOnly: { type: 'boolean' },
        constraints: { type: 'object' },
        options: { type: 'array', items: { type: 'object', properties: { value: {}, label: { type: 'string' } } } },
        multiple: { type: 'boolean' },
        lookup: {
          type: 'object',
          properties: { operation: { type: 'string' }, method: { type: 'string' }, path: { type: 'string' } },
        },
        visibleWhen: { type: 'object' },
        requiredWhen: { type: 'object' },
        value: {},
        blocks: { type: 'array', items: BLOCK },
      },
    },
  },
};
