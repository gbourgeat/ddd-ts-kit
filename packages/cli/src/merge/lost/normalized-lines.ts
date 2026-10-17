/** A line as the comparison reads it, with the line of the file it comes from (1-based). */
export interface NormalizedLine {
  readonly text: string;
  readonly line: number;
}

/**
 * A line of punctuation only (a brace, a bracket, a comma), or a conflict marker a side committed
 * by mistake: losing one says nothing a check can trust.
 */
const TRIVIAL = /^(?:[\s[\](){};,.'"`<>/*-]*|(?:<{7}|>{7}|\|{7})(?: .*)?)$/;

/** An import of named bindings, written on one line, once its statement was joined. */
const NAMED_IMPORT = /^import\s+(type\s+)?(?:([\w$]+)\s*,\s*)?\{([^}]*)\}\s*from\s*(['"][^'"]+['"])\s*;?$/;

/** An import whose braces span several lines, as a formatter writes a long one. */
const MULTILINE_IMPORT =
  /^([ \t]*import\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\{)([^}]*\n[^}]*)(\}\s*from\s*['"][^'"]+['"]\s*;?)/gm;

/**
 * The lines of a file as the lost-lines check compares them: trimmed, inner whitespace
 * collapsed, the trivial ones left out, and each import of named bindings split into one entry
 * per binding, so that two imports from one module merged into one statement, or one statement
 * laid out on several lines, compare equal.
 */
export function normalizedLines(content: string): NormalizedLine[] {
  const lines = joinedImports(content).split('\n');

  return lines.flatMap((raw, index) => {
    const text = raw.trim().replace(/\s+/g, ' ');

    return TRIVIAL.test(text) ? [] : entriesOf(text).map((entry) => ({ text: entry, line: index + 1 }));
  });
}

/** Joins the lines of each import of named bindings onto its first one, keeping the count of lines. */
function joinedImports(content: string): string {
  return content.replace(MULTILINE_IMPORT, (statement) => {
    const breaks = statement.split('\n').length - 1;

    return `${statement.replace(/\s+/g, ' ')}${'\n'.repeat(breaks)}`;
  });
}

function entriesOf(text: string): string[] {
  const named = NAMED_IMPORT.exec(text);

  if (named === null) {
    return [text];
  }

  const [, type = '', main, names = '', module = ''] = named;

  const bindings = names
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');

  return [
    ...(main === undefined ? [] : [`import ${type}${main} from ${module}`]),
    ...bindings.map((name) => `import ${type}{ ${name} } from ${module}`),
  ];
}
