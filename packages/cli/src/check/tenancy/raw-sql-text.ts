import type { SourceFile } from '../model/source-file';

const QUOTES = new Set(["'", '"']);
const BACKTICK = '`';

/**
 * The SQL text of the first argument of a raw call, from the source: a string literal, or a
 * template without interpolation. `undefined` when the argument is not a literal (a variable, a
 * call) or is a template that interpolates: what an interpolation holds may be SQL of its own,
 * and cannot be read here.
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
  const template = end === -1 ? undefined : file.text.slice(start + 1, end);

  return template === undefined || template.includes('${') ? undefined : template;
}

function firstArgument(code: string, from: number): number {
  let index = from;

  while (/\s/.test(code.charAt(index))) {
    index += 1;
  }

  return index;
}
