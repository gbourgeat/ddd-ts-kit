import { splitAtCommas } from '../text/split-at-commas.js';
import { typeBrackets } from '../text/type-brackets.js';
import { typeClosing } from '../text/type-closing.js';

const WRAPPER = /^(?:Readonly|Partial|Required)\s*</;
const RECORD = /^Record\s*</;

/**
 * The key and the value types of `Record<K, V>`, when `type` is one, alone or wrapped whole in
 * `Readonly`, `Partial` or `Required`: `Readonly<Record<K, V>> & Other` is not one.
 */
export function recordArguments(type: string): readonly [string, string] | undefined {
  let current = type.trim();

  for (let inner = argumentsOf(current, WRAPPER); inner !== undefined; inner = argumentsOf(current, WRAPPER)) {
    current = inner.trim();
  }

  const record = argumentsOf(current, RECORD);
  const [key, value, ...more] = record === undefined ? [] : splitAtCommas(record, typeBrackets);

  return key !== undefined && value !== undefined && more.length === 0 ? [key.code, value.code] : undefined;
}

/** What is inside the angle brackets of `Name<..>` when they close at the end of `type`. */
function argumentsOf(type: string, head: RegExp): string | undefined {
  const opening = head.exec(type);

  if (opening === null) {
    return undefined;
  }

  const open = opening[0].length - 1;

  return typeClosing(type, open) === type.length - 1 ? type.slice(open + 1, -1) : undefined;
}
