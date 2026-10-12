import { DECLARATION_DECORATORS, DECORATOR_ENTRIES } from '../../declared/declared-role.js';
import type { Scan } from '../scan/scan.js';
import { braceDepthAt } from '../text/brace-depth-at.js';
import { BRACKETS } from '../text/brackets.js';
import { DECLARATIONS_ENTRY } from './declarations-entry.js';
import type { DeclaredClass } from './declared-class.js';
import type { Decoration } from './decoration.js';

const CLASS = /(?<![\w$.])(?:(export)\s+(?:default\s+)?)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g;
const DECORATOR_NAME = /@([\w$]+(?:\s*\.\s*[\w$]+)*)\s*$/;
const EXPORT_BEFORE = /(?<![\w$.])export\s*$/;

const read = new WeakMap<Scan, readonly DeclaredClass[]>();

/**
 * The classes declared at the top level of a source, each with the declaration decorators it
 * carries. A decorator counts when its name is imported, under that very name, from its entry
 * in the same file: the declarations entry of the kernel, or `@ddd-ts-kit/http` for the edge.
 */
export function classesOf(scan: Scan): readonly DeclaredClass[] {
  const known = read.get(scan);

  if (known !== undefined) {
    return known;
  }

  const classes = readClasses(scan);

  read.set(scan, classes);

  return classes;
}

function readClasses(scan: Scan): DeclaredClass[] {
  const imported = importedDecorators(scan);
  const { code } = scan;

  return [...code.matchAll(CLASS)]
    .filter((match) => braceDepthAt(code, match.index) === 0)
    .map((match) => {
      const before =
        imported.size === 0 ? { decorations: [], start: match.index } : decorationsBefore(scan, match.index);

      return {
        name: match[2] ?? '',
        line: scan.lineAt(match.index),
        start: match.index,
        exported: match[1] !== undefined || EXPORT_BEFORE.test(code.slice(0, before.start)),
        decorations: before.decorations.filter(({ name }) => imported.has(name)),
      };
    });
}

function importedDecorators(scan: Scan): ReadonlySet<string> {
  const names = scan.imports.flatMap(({ specifier, names: bound }) =>
    bound.filter((name) => specifier === (DECORATOR_ENTRIES[name] ?? DECLARATIONS_ENTRY)),
  );

  return new Set(names.filter((name) => DECLARATION_DECORATORS.includes(name)));
}

/** Walks back from a class over the decorators written above it, whatever they are. */
function decorationsBefore(scan: Scan, classStart: number): { decorations: Decoration[]; start: number } {
  const decorations: Decoration[] = [];
  let start = classStart;

  for (;;) {
    const decoration = decorationEndingAt(scan, scan.code.slice(0, start).trimEnd().length);

    if (decoration === undefined) {
      return { decorations, start };
    }

    decorations.unshift(decoration);
    start = decoration.start;
  }
}

function decorationEndingAt(scan: Scan, end: number): Decoration | undefined {
  const { code } = scan;
  const called = code.charAt(end - 1) === ')';
  const close = called ? end - 1 : end;
  const open = called ? openingOf(code, close) : end;
  const name = DECORATOR_NAME.exec(code.slice(Math.max(0, open - 200), open));

  if (name === null) {
    return undefined;
  }

  const start = open - name[0].length;

  return { name: (name[1] ?? '').replace(/\s+/g, ''), line: scan.lineAt(start), start, open, close };
}

/** Offset of the bracket opening the one closed at `close`, or 0. */
function openingOf(code: string, close: number): number {
  let depth = 0;

  for (let at = close; at >= 0; at -= 1) {
    const char = code.charAt(at);

    if (BRACKETS.closers.includes(char)) {
      depth += 1;
    } else if (BRACKETS.openers.includes(char) && (depth -= 1) === 0) {
      return at;
    }
  }

  return 0;
}
