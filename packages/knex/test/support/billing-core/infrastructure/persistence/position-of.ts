import { InvalidPageRequestError, decodeCursor } from '@ddd-ts-kit/kernel';

export interface InvoicePosition {
  readonly amount: number;
  readonly id: string;
}

/** A cursor comes back from a client: what it decodes to is checked before it reaches a statement. */
export function positionOf(cursor: string): InvoicePosition {
  const { amount, id } = decodeCursor(cursor);

  if (typeof amount !== 'number' || typeof id !== 'string') {
    throw new InvalidPageRequestError('The cursor of a page is the nextCursor of a previous page');
  }

  return { amount, id };
}
