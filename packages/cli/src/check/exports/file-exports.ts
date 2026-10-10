import type { SourceFile } from '../model/source-file.js';
import { braceDepthAt } from '../text/brace-depth-at.js';
import { endAtDepthZero } from '../text/end-at-depth-zero.js';
import { matchingBracket } from '../text/matching-bracket.js';
import type { Exported } from './exported.js';

const DECLARED =
  /(?<![\w$.])export\s+(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(class|function|interface|const\s+enum|const|let|var|type|enum)\b\s*\*?\s*([A-Za-z_$][\w$]*)/g;

const ANONYMOUS_DEFAULT = /(?<![\w$.])export\s+default\s+(?:abstract\s+)?(?:async\s+)?(class|function)\s*\*?\s*[({<]/g;
const LOCAL_LIST = /(?<![\w$.])export\s*\{([^}]*)\}(?!\s*from\b)/g;

const KINDS: Readonly<Record<string, Exported['kind']>> = {
  class: 'class',
  function: 'function',
  interface: 'interface',
  const: 'const',
  let: 'const',
  var: 'const',
  type: 'type',
  enum: 'enum',
};

type Placed = Exported & { readonly at: number };

/** A declaration found in the code: where it starts, where its name ends, and what it declares. */
interface Found {
  readonly at: number;
  readonly afterName: number;
  readonly keyword: string;
  readonly name: string;
}

/** What a source exports from its own declarations, in source order; re-exports (`export .. from`) are not in it. */
export function fileExports(file: SourceFile): Exported[] {
  const { code } = file.scan;

  const declared = [...code.matchAll(DECLARED)]
    .filter((match) => braceDepthAt(code, match.index) === 0)
    .map((match) =>
      declaredAt(file, {
        at: match.index,
        afterName: match.index + match[0].length,
        keyword: match[1] ?? '',
        name: match[2] ?? '',
      }),
    );

  const anonymous = [...code.matchAll(ANONYMOUS_DEFAULT)].map((match) =>
    declaredAt(file, {
      at: match.index,
      afterName: match.index + match[0].length - 1,
      keyword: match[1] ?? '',
      name: 'default',
    }),
  );

  const listed = [...code.matchAll(LOCAL_LIST)].flatMap((match) => listedExports(file, match));

  return [...declared, ...anonymous, ...listed]
    .sort((left, right) => left.at - right.at)
    .map(({ name, kind, line, text, signature }) => ({ name, kind, line, text, signature }));
}

function declaredAt(file: SourceFile, { at, afterName, keyword, name }: Found): Placed {
  const { code } = file.scan;
  const kind = KINDS[keyword.replace(/^const\s+enum$/, 'enum')] ?? 'const';
  const { end, body } = extentOf(code, afterName, kind);

  return {
    at,
    name,
    kind,
    line: file.scan.lineAt(at),
    text: code.slice(at, end),
    signature: code.slice(at, kind === 'function' ? (body ?? end) : end),
  };
}

/** Where a declaration ends, and for a function where its body opens. */
function extentOf(code: string, afterName: number, kind: Exported['kind']): { end: number; body?: number } {
  if (kind === 'const' || kind === 'type') {
    return { end: endAtDepthZero(code, afterName, ';') };
  }

  if (kind !== 'function') {
    return { end: matchingBracket(code, endAtDepthZero(code, afterName, '{')) + 1 };
  }

  const closeParenthesis = matchingBracket(code, code.indexOf('(', afterName));
  const body = bodyAfter(code, closeParenthesis);

  return body === undefined
    ? { end: endAtDepthZero(code, closeParenthesis + 1, ';') }
    : { end: matchingBracket(code, body) + 1, body };
}

/** The brace opening the body of a function whose parameter list closes at `closeParenthesis`; undefined for an overload. */
function bodyAfter(code: string, closeParenthesis: number): number | undefined {
  const rest = /^\)[^;{]*?(?:\{[^;{}]*\}[^;{]*?)*\{/.exec(code.slice(closeParenthesis));
  const semicolon = code.indexOf(';', closeParenthesis);

  if (rest === null) {
    return undefined;
  }

  const brace = closeParenthesis + rest[0].length - 1;

  return semicolon !== -1 && semicolon < brace ? undefined : brace;
}

/** `export { A, B as C }`: each name with the kind of the local declaration it points to. */
function listedExports(file: SourceFile, match: RegExpExecArray): Placed[] {
  const { code } = file.scan;

  const names = (match[1] ?? '')
    .split(',')
    .map((part) => part.trim().replace(/^type\s+/, ''))
    .filter((part) => part !== '');

  return names.map((part) => {
    const [local = '', alias] = part.split(/\s+as\s+/);

    const declaration = new RegExp(
      `(?<![\\w$.])(?:abstract\\s+)?(?:async\\s+)?(class|function|interface|type|enum)\\s*\\*?\\s*${local.replace(/\$/g, '\\$')}(?![\\w$])`,
    ).exec(code);

    if (declaration === null) {
      return {
        at: match.index,
        name: alias ?? local,
        kind: 'const',
        line: file.scan.lineAt(match.index),
        text: '',
        signature: '',
      };
    }

    const found = {
      at: declaration.index,
      afterName: declaration.index + declaration[0].length,
      keyword: declaration[1] ?? '',
      name: alias ?? local,
    };

    return { ...declaredAt(file, found), at: match.index, line: file.scan.lineAt(match.index) };
  });
}
