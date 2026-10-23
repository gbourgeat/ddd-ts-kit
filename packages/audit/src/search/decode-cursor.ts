import { InvalidPageRequestError } from '@ddd-ts-kit/kernel';
import type { CursorPosition } from './cursor-position';

export function decodeCursor(cursor: string): CursorPosition {
  const [occurredAt, chain, sequence] = parsed(Buffer.from(cursor, 'base64url').toString('utf8'));

  if (typeof occurredAt !== 'string' || typeof chain !== 'string' || typeof sequence !== 'number') {
    throw new InvalidPageRequestError('The cursor of a page is not one this list gave');
  }

  return { occurredAt: new Date(occurredAt), chain, sequence };
}

function parsed(text: string): readonly unknown[] {
  try {
    const value: unknown = JSON.parse(text);

    return isList(value) ? value : [];
  } catch {
    return [];
  }
}

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
