import { typeBrackets } from '../text/type-brackets';
import { typeClosing } from '../text/type-closing';

const KEYOF = /^keyof\s+/;
/** `Name`, `ns.Name`, `Name<..>`, `typeof value`, `typeof ns.value`: the root is the first name. */
const REFERENCE = /^(?:typeof\s+)?([A-Za-z_$][\w$]*)(?:\s*\.\s*[A-Za-z_$][\w$]*)*\s*(<[^]*>)?$/;

/**
 * The name a type written as one reference starts from: `Payload` for `Payload['state']`,
 * `typeof x`, `keyof typeof x`, `ns.Name`, `Name<..>` or `(typeof x)[..]`. Nothing for a union,
 * an intersection, an array, a literal or an object type, which are not one reference.
 */
export function typeRoot(type: string): string | undefined {
  const written = type.trim();
  const keyof = KEYOF.exec(written);

  if (keyof !== null) {
    return typeRoot(written.slice(keyof[0].length));
  }

  const indexed = indexedObject(written);

  if (indexed !== undefined) {
    return typeRoot(indexed);
  }

  if (written.startsWith('(') && typeClosing(written, 0) === written.length - 1) {
    return typeRoot(written.slice(1, -1));
  }

  const reference = REFERENCE.exec(written);
  const closes = reference?.[2] === undefined || typeClosing(written, written.indexOf('<')) === written.length - 1;

  return closes ? reference?.[1] : undefined;
}

/** `Payload` for `Payload['state']`: what an indexed access reads, when the index is not empty (`Name[]` is an array). */
function indexedObject(type: string): string | undefined {
  if (!type.endsWith(']')) {
    return undefined;
  }

  let depth = 0;

  for (let i = type.length - 1; i > 0; i -= 1) {
    depth -= typeBrackets(type.charAt(i), type.charAt(i - 1));

    if (depth === 0) {
      const object = type.slice(0, i).trim();

      return type.slice(i + 1, -1).trim() === '' || object === '' ? undefined : object;
    }
  }

  return undefined;
}
