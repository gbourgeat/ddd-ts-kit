const TYPE_HEAD =
  /^(?:export\s+(?:default\s+)?)?(?:declare\s+)?(?:interface|type)\s+[A-Za-z_$]|^import\s+type\b|^export\s+type\s*[{*]/;

const RUNTIME_HEAD =
  /^(?:export|const|let|var|function|class|enum|abstract|async|namespace|module|import|declare|if|for|while|return|new|await)\b|^@|^[A-Za-z_$][\w$]*\s*[(=.]/;

const COMMENT_OR_STRING =
  /\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g;

/**
 * Whether a TypeScript source declares types only (interfaces, type aliases, type imports and
 * re-exports): once compiled it holds no statement, so no spec loads it and the `v8` provider of
 * Jest reports all its lines uncovered. Read from the text, a statement at a time, without a
 * parser: any top-level line it cannot tell from runtime code leaves the file measured.
 */
export function isTypeOnlySource(source: string): boolean {
  let open = false;
  let declaresType = false;

  for (const { text, depth } of topLevelLines(source)) {
    if (TYPE_HEAD.test(text)) {
      declaresType = true;
    } else if (!open || RUNTIME_HEAD.test(text)) {
      return false;
    }

    open = !(text.endsWith(';') && depth === 0);
  }

  return declaresType;
}

interface TopLevelLine {
  readonly text: string;
  /** The depth of braces, parentheses and brackets at its end. */
  readonly depth: number;
}

/** The lines that start outside any braces, parentheses or brackets, comments removed and strings emptied. */
function topLevelLines(source: string): TopLevelLine[] {
  const lines: TopLevelLine[] = [];
  let depth = 0;

  for (const line of source.replace(COMMENT_OR_STRING, blank).split('\n')) {
    const text = line.trim();
    const starts = depth;

    depth += Array.from(line).reduce((sum, char) => sum + delta(char), 0);

    if (starts === 0 && text !== '') {
      lines.push({ text, depth });
    }
  }

  return lines;
}

/** A comment leaves its line breaks, a string leaves two quotes. */
function blank(match: string): string {
  return match.startsWith('/') ? match.replace(/[^\n]/g, '') : '""';
}

function delta(char: string): number {
  if ('{(['.includes(char)) {
    return 1;
  }

  return '})]'.includes(char) ? -1 : 0;
}
