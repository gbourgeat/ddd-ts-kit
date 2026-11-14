import type { StarModule } from './index-reading';

/** What a name is bound to: the origin of its value, of its type, either or both. */
export interface Bound {
  readonly value?: string;
  readonly type?: string;
}

/** What a file exports under a name: its value, its type, either or both. */
export function symbolOf({ symbols }: Pick<StarModule, 'symbols'>, name: string): Bound {
  const origin = (kind: 'value' | 'type'): string | undefined =>
    symbols.find((symbol) => symbol.name === name && symbol.kind === kind)?.origin;

  const value = origin('value');
  const type = origin('type');

  return { ...(value === undefined ? {} : { value }), ...(type === undefined ? {} : { type }) };
}
