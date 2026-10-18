import { scan } from '../check/scan/scan.js';
import { escapeRegExp } from '../check/text/escape-reg-exp.js';

const NAMED = /^import\s+(type\s+)?\{([^}]*)\}\s*from\s*(['"][^'"]+['"]);?\s*$/;
const WHOLE = /^import\s+(?:type\s+)?(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s+from\s/;

/**
 * The import lines whose names a text reads, each one cut to the names it reads; a line that
 * imports nothing the text reads goes. A text moved to a file of its own keeps only what it needs.
 */
export function importsUsedBy(imports: readonly string[], text: string): string[] {
  const { code } = scan(text);
  const reads = (name: string): boolean => new RegExp(`(?<![\\w$.])${escapeRegExp(name)}(?![\\w$])`).test(code);

  return imports.flatMap((line) => {
    const named = NAMED.exec(line.trim());

    if (named === null) {
      const whole = WHOLE.exec(line.trim())?.[1];

      return whole !== undefined && reads(whole) ? [line] : [];
    }

    const names = (named[2] ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '' && reads(localName(part)));

    return names.length === 0 ? [] : [`import ${named[1] ?? ''}{ ${names.join(', ')} } from ${named[3] ?? "''"};\n`];
  });
}

/** `type A as B` is read as `B`. */
function localName(part: string): string {
  return (
    part
      .replace(/^type\s+/, '')
      .split(/\s+as\s+/)
      .at(-1) ?? part
  );
}
