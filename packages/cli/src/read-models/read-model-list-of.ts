import type { Config } from '../config';
import type { SourceFile } from '../check/model/source-file';
import { resolveImport } from '../check/project/resolve-import';
import type { Scan } from '../check/scan/scan';
import { matchingBracket } from '../check/text/matching-bracket';
import { regionsOf } from '../markers';
import type { ImportedClass, ListedEntry, NamedStore, ReadModelList } from './read-model-list';

const ENTRY = /\[\s*(['"])[^'"]*\1\s*,\s*([\w$]+)\s*,?\s*\]/g;
const IMPORT = /(?<![\w$.])import\s+(?:type\s+)?(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\}\s*)?from\s*(?=['"])/g;
/** The regions `init` writes in the list, which `init --force` keeps: it deletes any other, markers and all. */
const KEPT_REGIONS = ['imports', 'contexts', 'read-model-tables', 'read-models-not-listed'];

const LEFT_OUT = /(?<![\w$-])([\w-]+): ([\w$]+)/g;
const NAMED = /^([^\s:]+): ([\w$]+)$/;

/** The extent of an array a constant is given in the file, from one bracket to the other. */
interface Extent {
  readonly open: number;
  readonly close: number;
}

/**
 * Reads the list of the read model tables from its text: the entries of `LISTED`, the stores
 * `NOT_LISTED` names, the classes the file imports and the stores a comment between its markers
 * leaves out. Only what is written in the
 * file is read: an entry spread from elsewhere, or built by a call, makes the list one the
 * reading cannot answer for, and `unread` says where.
 */
export function readModelListOf(config: Config, { path: file, scan, text }: SourceFile): ReadModelList {
  const listed = extentOf(scan.code, 'LISTED');
  const notListed = extentOf(scan.code, 'NOT_LISTED');

  return {
    file,
    unread: listed === undefined ? 1 : unreadIn(scan, listed),
    entries: listed === undefined ? [] : entriesIn(scan, listed),
    notListed: notListed === undefined ? [] : namedIn(scan, notListed),
    imports: importsOf(config, file, scan),
    leftOut: leftOutIn(scan, text),
  };
}

function extentOf(code: string, constant: string): Extent | undefined {
  const declared = new RegExp(`(?<![\\w$.])const\\s+${constant}\\b[^=;]*=\\s*\\[`).exec(code);

  if (declared === null) {
    return undefined;
  }

  const open = declared.index + declared[0].length - 1;

  return { open, close: matchingBracket(code, open) };
}

function entriesIn(scan: Scan, { open, close }: Extent): ListedEntry[] {
  return [...scan.code.slice(open + 1, close).matchAll(ENTRY)].map((match) => {
    const start = open + 1 + match.index;

    return {
      context: stringIn(scan, start, start + match[0].length),
      local: match[2] ?? '',
      line: scan.lineAt(start),
    };
  });
}

/** The line of the first thing between the brackets that is no entry, when there is one. */
function unreadIn(scan: Scan, { open, close }: Extent): number | undefined {
  const rest = scan.code.slice(open + 1, close).replace(ENTRY, (entry) => entry.replace(/\S/g, ' '));
  const first = rest.search(/[^\s,]/);

  return first === -1 ? undefined : scan.lineAt(open + 1 + first);
}

function namedIn(scan: Scan, { open, close }: Extent): NamedStore[] {
  return scan.strings
    .filter(({ start }) => start > open && start < close)
    .flatMap(({ value, line }) => {
      const [, context, store] = NAMED.exec(value) ?? [];

      return context === undefined || store === undefined ? [] : [{ context, store, line }];
    });
}

/** What the comments between the markers of a region the template writes name, `<context>: <Store>`. */
function leftOutIn(scan: Scan, text: string): Set<string> {
  const regions = regionsOf(text.split('\n'));
  const kept = regions.filter(({ name }) => KEPT_REGIONS.includes(name));
  const isKept = (line: number): boolean => kept.some(({ open, close }) => line > open + 1 && line < close + 1);
  const comments = [...scan.comments, ...scan.blockComments].filter(({ line }) => isKept(line));

  return new Set(
    comments.flatMap((comment) =>
      [...comment.text.matchAll(LEFT_OUT)].map(([, context, store]) => `${context}: ${store}`),
    ),
  );
}

function importsOf(config: Config, file: string, scan: Scan): Map<string, ImportedClass> {
  const imports = new Map<string, ImportedClass>();

  for (const match of scan.code.matchAll(IMPORT)) {
    const end = match.index + match[0].length;
    const target = resolveImport(config, file, stringIn(scan, end, end + 1));
    const [, byDefault, named = ''] = match;

    if (byDefault !== undefined) {
      imports.set(byDefault, { name: 'default', target });
    }

    for (const binding of named.split(',')) {
      const [name = '', local = name] = binding
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/);

      if (name !== '') {
        imports.set(local, { name, target });
      }
    }
  }

  return imports;
}

/** The content of the string literal that starts between two offsets of the file. */
function stringIn(scan: Scan, from: number, to: number): string {
  return scan.strings.find(({ start }) => start >= from && start < to)?.value ?? '';
}
