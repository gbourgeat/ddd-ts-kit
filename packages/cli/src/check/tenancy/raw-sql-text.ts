import type { SourceFile } from '../model/source-file.js';

const QUOTES = new Set(["'", '"']);
const BACKTICK = '`';

/**
 * The SQL text of the first argument of a raw call, from the source: a string literal, or the
 * text of a template without what its interpolations hold. `undefined` when the argument is not
 * a literal (a variable, a call): what it holds cannot be read here.
 */
export function rawSqlText(file: SourceFile, argumentsStart: number): string | undefined {
  const start = firstArgument(file.scan.code, argumentsStart);
  const opening = file.scan.code.charAt(start);

  if (QUOTES.has(opening)) {
    return file.scan.strings.find((literal) => literal.start === start)?.value;
  }

  if (opening !== BACKTICK) {
    return undefined;
  }

  const end = file.scan.code.indexOf(BACKTICK, start + 1);

  return end === -1 ? undefined : withoutInterpolations(file.text.slice(start + 1, end));
}

function firstArgument(code: string, from: number): number {
  let index = from;

  while (/\s/.test(code.charAt(index))) {
    index += 1;
  }

  return index;
}

/** The literal parts of a template: an interpolation is blanked in the code, and read nowhere here. */
function withoutInterpolations(template: string): string {
  return template.replace(/\$\{[^}]*\}/g, ' ');
}
