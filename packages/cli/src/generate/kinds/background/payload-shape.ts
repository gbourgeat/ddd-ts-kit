/** What a field of a payload holds, as its schema checks it. */
export type PayloadShape =
  | { readonly kind: 'string' | 'number' | 'boolean' | 'instant' }
  | { readonly kind: 'list'; readonly of: PrimitiveKind }
  | { readonly kind: 'literals'; readonly values: readonly string[] }
  /** A type the generator writes no check for: its schema says `TODO(domain)` and types it `unknown`. */
  | { readonly kind: 'unread'; readonly type: string };

export type PrimitiveKind = 'string' | 'number' | 'boolean';

const PRIMITIVES: ReadonlySet<string> = new Set(['string', 'number', 'boolean']);
const LIST = /^(?:readonly\s+)?(\w+)\[\]$|^(?:Readonly)?Array<\s*(\w+)\s*>$/;
const QUOTED = /^'([^']*)'$|^"([^"]*)"$/;

/** Reads `string`, `readonly number[]` or `'draft' | 'sent'`, a `| undefined` aside: an instant is read before, by its `Date`. */
export function payloadShapeOf(type: string): PayloadShape {
  const written = withoutUndefined(type);

  if (isPrimitive(written)) {
    return { kind: written };
  }

  const listed = LIST.exec(written);
  const item = listed?.[1] ?? listed?.[2];

  if (item !== undefined && isPrimitive(item)) {
    return { kind: 'list', of: item };
  }

  const values = written.split('|').map((part) => QUOTED.exec(part.trim()));

  if (values.every((value) => value !== null)) {
    return { kind: 'literals', values: values.map((value) => value[1] ?? value[2] ?? '') };
  }

  return { kind: 'unread', type: written };
}

function withoutUndefined(type: string): string {
  return type
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== 'undefined')
    .join(' | ');
}

function isPrimitive(type: string): type is PrimitiveKind {
  return PRIMITIVES.has(type);
}
