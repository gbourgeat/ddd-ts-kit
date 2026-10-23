import { escapeRegExp } from '../check/text/escape-reg-exp';

const MENTIONS = new Map<string, RegExp>();

/**
 * The ids of `ids` a text mentions, word-bounded: `M1.3` is not mentioned by `M1.35`, nor `4.15`
 * by `14.15`. An id written as a number alone counts only with its `#` (`#12`): a bare number is
 * too often something else.
 */
export function mentionedRows(text: string, ids: readonly string[]): string[] {
  return ids.filter((id) => mentionOf(id).test(text));
}

function mentionOf(id: string): RegExp {
  const known = MENTIONS.get(id);

  if (known !== undefined) {
    return known;
  }

  const written = /^\d+$/.test(id) ? `#${escapeRegExp(id)}` : `#?${escapeRegExp(id)}`;
  const mention = new RegExp(`(?<![\\w.#])${written}(?!\\w|\\.\\d)`);

  MENTIONS.set(id, mention);

  return mention;
}
