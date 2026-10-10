/** The braces of a source that open and close a block of statements, by offset in its blanked code. */
export interface StatementBlocks {
  readonly opens: ReadonlySet<number>;
  readonly closes: ReadonlySet<number>;
}

const NOT_A_BODY = new Set([
  'return',
  'typeof',
  'in',
  'of',
  'as',
  'satisfies',
  'extends',
  'default',
  'yield',
  'await',
  'import',
  'export',
  'type',
  'const',
  'let',
  'var',
  'new',
  'throw',
  'is',
  'keyof',
  'readonly',
]);

const AFTER_A_SIGNATURE = ')]}>;{\'"`';
const DECLARES_NO_STATEMENT = /(?<![\w$.])(?:interface|enum|namespace|module|global)(?![\w$])/;
const LABEL = /(?:^|[;{}])\s*(?:case\b[^;{}]*|default\s*):\s*$/;

/**
 * Tells the blocks ESLint pads (a function body, a class body, the body of `if`, `for`, `try`,
 * `switch`, a static block) from the braces that hold no statement: an object literal, a type
 * literal, an interface, an enum, a namespace, a destructuring pattern, an import or export list.
 * Read from what precedes the brace; when that does not say, the brace is not a block.
 */
export function statementBlocks(code: string): StatementBlocks {
  const opens = new Set<number>();
  const closes = new Set<number>();
  const pending: { at: number; isBlock: boolean }[] = [];

  for (let at = 0; at < code.length; at += 1) {
    const char = code.charAt(at);

    if (char === '{') {
      pending.push({ at, isBlock: opensBlock(code, at, pending.at(-1)?.isBlock ?? true) });
    }

    if (char !== '}') {
      continue;
    }

    const opened = pending.pop();

    if (opened?.isBlock !== true) {
      continue;
    }

    opens.add(opened.at);
    closes.add(at);
  }

  return { opens, closes };
}

/** `inBlock` says whether the brace is written among statements: only there is `case x:` or `default:` a label. */
function opensBlock(code: string, brace: number, inBlock: boolean): boolean {
  const before = code.slice(Math.max(0, brace - 400), brace).trimEnd();
  const previous = before.charAt(before.length - 1);

  const statement = before.slice(
    Math.max(before.lastIndexOf(';'), before.lastIndexOf('{'), before.lastIndexOf('}')) + 1,
  );

  if (code.charAt(brace - 1) === '$' || DECLARES_NO_STATEMENT.test(statement)) {
    return false;
  }

  if (previous === ':') {
    return inBlock && LABEL.test(before);
  }

  if (previous === '' || AFTER_A_SIGNATURE.includes(previous)) {
    return true;
  }

  const word = /[\w$]+$/.exec(before)?.[0];

  return word !== undefined && !NOT_A_BODY.has(word);
}
