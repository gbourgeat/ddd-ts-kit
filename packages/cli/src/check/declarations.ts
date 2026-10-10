import { DECLARATION_DECORATORS } from '../declared/roles.js';
import type { Scan } from './scanner.js';
import { braceDepthAt } from './text-shapes.js';

/**
 * The declaration decorators a source puts on its classes, read on the blanked code of the
 * scanner. A decorator counts when its name is imported, under that very name, from the
 * declarations entry of the kernel in the same file; string values come from the literals the
 * scanner recorded.
 */

export const DECLARATIONS_ENTRY = '@ddd-ts-kit/kernel/declarations';

export interface Decoration {
  readonly name: string;
  readonly line: number;
  /** Offset of the `@`. */
  readonly start: number;
  /** Offsets of the parentheses around the arguments; equal when the decorator is not called. */
  readonly open: number;
  readonly close: number;
}

export interface DeclaredClass {
  readonly name: string;
  readonly line: number;
  readonly exported: boolean;
  /** The declaration decorators the class carries, in source order. */
  readonly decorations: readonly Decoration[];
}

/** What an option of a decorator holds. */
export interface OptionValue {
  /** Undefined when the value is a variable, a template with substitutions, a concatenation or a shorthand. */
  readonly literal: string | undefined;
  readonly line: number;
}

const CLASS = /(?<![\w$.])(?:(export)\s+(?:default\s+)?)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g;
const DECORATOR_NAME = /@([\w$]+(?:\s*\.\s*[\w$]+)*)\s*$/;
const EXPORT_BEFORE = /(?<![\w$.])export\s*$/;
const OPENERS = '([{';
const CLOSERS = ')]}';

const read = new WeakMap<Scan, readonly DeclaredClass[]>();

/** The classes declared at the top level of a source, each with the declaration decorators it carries. */
export function classesOf(scan: Scan): readonly DeclaredClass[] {
  const known = read.get(scan);
  if (known !== undefined) return known;
  const classes = readClasses(scan);
  read.set(scan, classes);
  return classes;
}

/** The exported classes of a source that carry one of `decorators`, with that decoration. */
export function declaredAs(scan: Scan, decorators: readonly string[]): { readonly declared: DeclaredClass; readonly decoration: Decoration }[] {
  return classesOf(scan).flatMap((declared) => {
    const decoration = declared.exported ? declared.decorations.find(({ name }) => decorators.includes(name)) : undefined;
    return decoration === undefined ? [] : [{ declared, decoration }];
  });
}

/** The blanked code of each argument of a decorator, trimmed, with the offset it starts at. */
export function argumentsOf(scan: Scan, { open, close }: Decoration): { readonly code: string; readonly start: number }[] {
  const { code } = scan;
  const parts: { code: string; start: number }[] = [];
  const keep = (from: number, to: number): void => {
    const raw = code.slice(from, to);
    if (raw.trim() !== '') parts.push({ code: raw.trim(), start: from + raw.length - raw.trimStart().length });
  };
  let depth = 0;
  let start = open + 1;
  for (let at = start; at < close; at += 1) {
    const char = code.charAt(at);
    if (OPENERS.includes(char)) depth += 1;
    else if (CLOSERS.includes(char)) depth -= 1;
    if (char !== ',' || depth !== 0) continue;
    keep(start, at);
    start = at + 1;
  }
  keep(start, close);
  return parts;
}

/** The first string literal written inside an argument, such as the permission name of `permissions['invoice.issue']`. */
export function literalIn(scan: Scan, argument: { readonly code: string; readonly start: number }): string | undefined {
  const end = argument.start + argument.code.length;
  return scan.strings.find((literal) => literal.start >= argument.start && literal.start < end)?.value;
}

/** The value of `key` in an options object given directly to the decorator, or undefined when no such key is written. */
export function optionOf(scan: Scan, decoration: Decoration, key: string): OptionValue | undefined {
  const { code } = scan;
  const pattern = new RegExp(`(?<![\\w$.])${key}\\s*(?::\\s*|(?=[,}]))`, 'g');
  pattern.lastIndex = decoration.open;
  for (let match = pattern.exec(code); match !== null && match.index < decoration.close; match = pattern.exec(code)) {
    if (!isDirectOption(code.slice(decoration.open + 1, match.index))) continue;
    const valueStart = match.index + match[0].length;
    const literal = scan.strings.find((candidate) => candidate.start === valueStart);
    const complete = literal !== undefined && /^\s*[,}]/.test(code.slice(literal.end, decoration.close + 1));
    return { literal: complete ? literal.value : undefined, line: scan.lineAt(match.index) };
  }
  return undefined;
}

/** True one brace deep and inside no call or list: the keys of an object passed as an argument. */
function isDirectOption(before: string): boolean {
  const net = (open: string, close: string): number => before.split(open).length - before.split(close).length;
  return net('{', '}') === 1 && net('(', ')') === 0 && net('[', ']') === 0;
}

function readClasses(scan: Scan): DeclaredClass[] {
  const imported = importedDecorators(scan);
  const { code } = scan;
  return [...code.matchAll(CLASS)]
    .filter((match) => braceDepthAt(code, match.index) === 0)
    .map((match) => {
      const before = imported.size === 0 ? { decorations: [], start: match.index } : decorationsBefore(scan, match.index);
      return {
        name: match[2] ?? '',
        line: scan.lineAt(match.index),
        exported: match[1] !== undefined || EXPORT_BEFORE.test(code.slice(0, before.start)),
        decorations: before.decorations.filter(({ name }) => imported.has(name)),
      };
    });
}

function importedDecorators(scan: Scan): ReadonlySet<string> {
  const names = scan.imports.filter(({ specifier }) => specifier === DECLARATIONS_ENTRY).flatMap(({ names: bound }) => bound);
  return new Set(names.filter((name) => DECLARATION_DECORATORS.includes(name)));
}

/** Walks back from a class over the decorators written above it, whatever they are. */
function decorationsBefore(scan: Scan, classStart: number): { decorations: Decoration[]; start: number } {
  const decorations: Decoration[] = [];
  let start = classStart;
  for (;;) {
    const decoration = decorationEndingAt(scan, scan.code.slice(0, start).trimEnd().length);
    if (decoration === undefined) return { decorations, start };
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
  if (name === null) return undefined;
  const start = open - name[0].length;
  return { name: (name[1] ?? '').replace(/\s+/g, ''), line: scan.lineAt(start), start, open, close };
}

/** Offset of the bracket opening the one closed at `close`, or 0. */
function openingOf(code: string, close: number): number {
  let depth = 0;
  for (let at = close; at >= 0; at -= 1) {
    const char = code.charAt(at);
    if (CLOSERS.includes(char)) depth += 1;
    else if (OPENERS.includes(char) && (depth -= 1) === 0) return at;
  }
  return 0;
}
