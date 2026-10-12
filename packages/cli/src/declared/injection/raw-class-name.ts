const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const GENERIC = /^([A-Za-z_$][\w$]*)\s*</;

/**
 * The class a type annotation names when it names exactly one: `Clock`, or `Cache` for
 * `Cache<Session>`, whose type arguments say nothing of the token. Undefined for a union, an
 * intersection, an array, a function, a literal, an object type or a qualified name.
 */
export function rawClassName(type: string): string | undefined {
  if (IDENTIFIER.test(type)) {
    return type;
  }

  const name = GENERIC.exec(type)?.[1];

  return name !== undefined && closesAtTheEnd(type, type.indexOf('<')) ? name : undefined;
}

function closesAtTheEnd(type: string, open: number): boolean {
  let depth = 0;

  for (let at = open; at < type.length; at += 1) {
    const char = type.charAt(at);

    if (char === '<') {
      depth += 1;
    } else if (char === '>' && type.charAt(at - 1) !== '=' && (depth -= 1) === 0) {
      return at === type.length - 1;
    }
  }

  return false;
}
