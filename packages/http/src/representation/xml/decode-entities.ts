import { XmlSyntaxError } from './xml-syntax-error.js';

// A map, not an object: `&constructor;` names no entity, whatever an object inherits.
const PREDEFINED: ReadonlyMap<string, string> = new Map([
  ['lt', '<'],
  ['gt', '>'],
  ['amp', '&'],
  ['quot', '"'],
  ['apos', "'"],
]);

const REFERENCE = /&(#x[0-9A-Fa-f]+|#[0-9]+|[A-Za-z]+);|&/g;
const HEXADECIMAL = 16;
const DECIMAL = 10;
const LAST_CODE_POINT = 0x10ffff;

/** Character data with its references replaced: the five predefined entities and numeric references, nothing else. */
export function decodeEntities(raw: string): string {
  return raw.replace(REFERENCE, (whole, reference: string | undefined) => {
    if (reference === undefined) {
      throw new XmlSyntaxError('a lone "&" in character data');
    }

    return characterOf(reference, whole);
  });
}

function characterOf(reference: string, whole: string): string {
  const predefined = PREDEFINED.get(reference);

  if (predefined !== undefined) {
    return predefined;
  }

  if (!reference.startsWith('#')) {
    throw new XmlSyntaxError(`the entity ${whole} is not declared`);
  }

  const hexadecimal = reference.startsWith('#x');
  const code = Number.parseInt(reference.slice(hexadecimal ? 2 : 1), hexadecimal ? HEXADECIMAL : DECIMAL);

  if (code === 0 || code > LAST_CODE_POINT) {
    throw new XmlSyntaxError(`the character reference ${whole} is out of range`);
  }

  return String.fromCodePoint(code);
}
