import { describe, expect, it } from 'vitest';
import type { Endpoint } from '../src/generate/kinds/route/endpoint';
import { messageFieldsOf } from '../src/generate/kinds/route/message-fields-of';
import { messagePlan } from '../src/generate/kinds/route/message-plan';
import type { UseCase } from '../src/generate/kinds/route/use-case';

const CANCEL = `import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';

export class CancelInvoiceCommand extends AuthorizedCommand {
  /** Who cancels, and why. */
  constructor(
    actor: Actor,
    readonly invoiceId: string, // the path names it
    readonly reason: string,
    readonly refundAmount: number,
  ) {
    super(actor);
  }
}
`;

const POST: Endpoint = { method: 'POST', path: '/invoices/:invoiceId/cancellation', parameters: ['invoiceId'] };

function useCaseOf(source: string, overrides: Partial<UseCase> = {}): UseCase {
  return {
    isQuery: false,
    message: 'CancelInvoiceCommand',
    messageFile: 'application/commands/cancel-invoice/cancel-invoice.command',
    returnsId: false,
    isProtected: true,
    isSearch: false,
    fields: messageFieldsOf(source),
    ...overrides,
  };
}

describe('the fields of a message, read from its constructor', () => {
  it('are the parameters past the actor, comments left out, each with its type', () => {
    expect(messageFieldsOf(CANCEL)).toEqual([
      { name: 'invoiceId', type: 'string', optional: false },
      { name: 'reason', type: 'string', optional: false },
      { name: 'refundAmount', type: 'number', optional: false },
    ]);
  });

  it('start at the first parameter of a public message, and are none before the message has a constructor', () => {
    const published =
      'export class PublishNote extends Command {\n  constructor(readonly text: string) {\n    super();\n  }\n}';

    const generated = `export class CancelInvoiceCommand extends AuthorizedCommand {\n  // TODO(domain): declare the input as a constructor, for example \`constructor(actor: Actor, readonly customerId: string) { super(actor); }\`.\n}`;

    expect(messageFieldsOf(published)).toEqual([{ name: 'text', type: 'string', optional: false }]);
    expect(messageFieldsOf(generated)).toEqual([]);
  });

  it('skip an actor declared as a property of the message', () => {
    const source =
      'class A {\n  constructor(readonly actor: Actor, readonly invoiceId: string) {\n    super(actor);\n  }\n}';

    expect(messageFieldsOf(source).map((field) => field.name)).toEqual(['invoiceId']);
  });
});

describe('the plan of a route that builds its message', () => {
  it('reads a path parameter from the path and the rest from the body, in the order of the constructor', () => {
    expect(messagePlan('zod', POST, useCaseOf(CANCEL))).toEqual({
      read: [
        { name: 'invoiceId', type: 'string', optional: false, kind: 'string', from: 'params' },
        { name: 'reason', type: 'string', optional: false, kind: 'string', from: 'body' },
        { name: 'refundAmount', type: 'number', optional: false, kind: 'number', from: 'body' },
      ],
      unread: [],
    });
  });

  it('stops at the first field it cannot read: a value object, an optional field, a number in the path, a field no body carries', () => {
    const period = CANCEL.replace('readonly reason: string', 'readonly period: Period');
    const optional = CANCEL.replace('readonly reason: string', 'readonly reason?: string');
    const numbered = CANCEL.replace('readonly invoiceId: string', 'readonly invoiceId: number');
    const deleted: Endpoint = { ...POST, method: 'DELETE' };

    expect(messagePlan('zod', POST, useCaseOf(period)).unread.map((field) => field.name)).toEqual([
      'period',
      'refundAmount',
    ]);

    expect(messagePlan('typebox', POST, useCaseOf(optional)).read.map((field) => field.name)).toEqual(['invoiceId']);
    expect(messagePlan('class-validator', POST, useCaseOf(numbered)).read).toEqual([]);

    expect(messagePlan('standard-schema', deleted, useCaseOf(CANCEL)).read.map((field) => field.name)).toEqual([
      'invoiceId',
    ]);
  });

  it('reads nothing for a search, nor under a validation library whose schema it does not write', () => {
    expect(messagePlan('zod', POST, useCaseOf(CANCEL, { isSearch: true }))).toEqual({ read: [], unread: [] });
    expect(messagePlan('none', POST, useCaseOf(CANCEL))).toEqual({ read: [], unread: [] });
  });
});
