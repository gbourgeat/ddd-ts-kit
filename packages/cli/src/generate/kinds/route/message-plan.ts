import type { Endpoint } from './endpoint';
import type { MessageField } from './message-fields-of';
import type { UseCase } from './use-case';

/** The types a route reads from a request and validates in each library of the kit. */
export type FieldKind = 'string' | 'number' | 'boolean';

/** A field of the message the route reads, and the part of the request it reads it from. */
export interface ReadField extends MessageField {
  readonly kind: FieldKind;
  readonly from: 'params' | 'body';
}

/**
 * How a route builds its message from the request: the fields it reads, in the order of the
 * constructor, up to the first it cannot read, and those it leaves to a `TODO(domain)`.
 */
export interface MessagePlan {
  readonly read: readonly ReadField[];
  readonly unread: readonly MessageField[];
}

const KINDS: readonly string[] = ['string', 'number', 'boolean'];
const WITH_BODY: readonly string[] = ['POST', 'PUT', 'PATCH'];
/** The libraries whose schema of a body the generator writes field by field. */
const BODY_LIBRARIES: readonly string[] = ['zod', 'class-validator', 'typebox', 'standard-schema'];

/** Nothing to read: a message without fields, a search, or a request mapper that builds it. */
export const NOTHING_READ: MessagePlan = { read: [], unread: [] };

/**
 * A string, a number or a boolean the message requires is read from the path when the route
 * names a parameter after it, a string only, or else from the body of a route that has one; any
 * other field (optional, a value object, a date, a nested object) stops the reading there.
 */
export function messagePlan(validation: string, endpoint: Endpoint, useCase: UseCase): MessagePlan {
  if (useCase.isSearch || !BODY_LIBRARIES.includes(validation)) {
    return NOTHING_READ;
  }

  const read: ReadField[] = [];

  for (const [index, field] of useCase.fields.entries()) {
    const readField = readFieldOf(field, endpoint);

    if (readField === undefined) {
      return { read, unread: useCase.fields.slice(index) };
    }

    read.push(readField);
  }

  return { read, unread: [] };
}

function readFieldOf(field: MessageField, endpoint: Endpoint): ReadField | undefined {
  const kind = field.type ?? '';

  if (field.optional || !isKind(kind)) {
    return undefined;
  }

  if (endpoint.parameters.includes(field.name)) {
    return kind === 'string' ? { ...field, kind, from: 'params' } : undefined;
  }

  return WITH_BODY.includes(endpoint.method) ? { ...field, kind, from: 'body' } : undefined;
}

function isKind(type: string): type is FieldKind {
  return KINDS.includes(type);
}
