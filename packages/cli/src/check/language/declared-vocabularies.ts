import { permissionSets } from '../authz/permission-sets.js';
import type { SourceFile } from '../model/source-file.js';
import { matchingBracket } from '../text/matching-bracket.js';
import type { DeclaredValue } from './declared-value.js';

const AS_CONST = /export\s+const\s+([A-Z][\w$]*)\s*=\s*\{/g;
const CONST_ASSERTION = /^\s*as\s+const\b/;
const ENTRY = /^\s*(?:([A-Za-z_$][\w$]*)|#(\d+)#)\s*:\s*#(\d+)#\s*$/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * The closed vocabularies the project declares, by value: every object `as const` of string
 * values next to the union type of the same name (`export type AppointmentStatus = (typeof
 * AppointmentStatus)[keyof typeof AppointmentStatus]`), and every permission set
 * (`definePermissions('billing', { 'invoice.issue': .. })` declares `billing:invoice.issue`).
 * Tests declare nothing. A value two vocabularies share is listed under both.
 */
export function declaredVocabularies(files: readonly SourceFile[]): Map<string, DeclaredValue[]> {
  const declared = new Map<string, DeclaredValue[]>();

  for (const file of files.filter((candidate) => !candidate.isTest)) {
    for (const value of [...objectValues(file), ...permissionValues(file)]) {
      declared.set(value.value, [...(declared.get(value.value) ?? []), value]);
    }
  }

  return declared;
}

function objectValues(file: SourceFile): DeclaredValue[] {
  const { code } = file.scan;

  return [...code.matchAll(AS_CONST)].flatMap((found) => {
    const name = found[1] ?? '';
    const open = found.index + found[0].length - 1;
    const close = matchingBracket(code, open);
    const entries = CONST_ASSERTION.test(code.slice(close + 1)) ? objectEntries(file, { open, close }) : [];

    if (!hasUnionType(code, name)) {
      return [];
    }

    const declared = { vocabulary: name, file: file.path, readBy: readerOf(file) };

    return entries.map(({ key, value }) => ({ ...declared, value, written: writtenAs(name, key) }));
  });
}

/**
 * The entries of the object between two braces, each `Key: 'value'` or `'key': "value"`, read on
 * the scanned code: comments are blanked, and a comma or a brace inside a string is not one. When
 * one entry is something else (a number, a spread, a computed key), the object is no vocabulary.
 */
function objectEntries(file: SourceFile, { open, close }: { open: number; close: number }): Entry[] {
  const literals = file.scan.strings.filter(({ start, end }) => start > open && end <= close);

  const body = literals.reduceRight(
    (text, literal, index) => `${text.slice(0, literal.start - open)}#${index}#${text.slice(literal.end - open)}`,
    file.scan.code.slice(open, close),
  );

  const entries = body
    .slice(1)
    .split(',')
    .filter((entry) => entry.trim().length > 0)
    .map((entry) => ENTRY.exec(entry));

  return entries.every((entry) => entry !== null)
    ? entries.map(([, key, quoted, value]) => ({
        key: key ?? literals[Number(quoted)]?.value ?? '',
        value: literals[Number(value)]?.value ?? '',
      }))
    : [];
}

interface Entry {
  readonly key: string;
  readonly value: string;
}

function writtenAs(name: string, key: string): string {
  return IDENTIFIER.test(key) ? `${name}.${key}` : `${name}['${key}']`;
}

/** A context speaks its own language; the shared kernel is read by every layer; the platform by itself and by the edges of the contexts. */
function readerOf(file: SourceFile): DeclaredValue['readBy'] {
  if (file.location.area === 'context') {
    return { context: file.location.context };
  }

  return file.location.area === 'shared-kernel' ? 'everywhere' : 'platform';
}

function hasUnionType(text: string, name: string): boolean {
  return new RegExp(
    `export\\s+type\\s+${name}\\s*=\\s*\\(\\s*typeof\\s+${name}\\s*\\)\\s*\\[\\s*keyof\\s+typeof\\s+${name}\\s*\\]`,
  ).test(text);
}

function permissionValues(file: SourceFile): DeclaredValue[] {
  return permissionSets(file).flatMap(({ set, context, keys }) =>
    keys.map(({ value: key }) => ({
      value: `${context}:${key}`,
      written: `${set}['${key}'].id`,
      vocabulary: set,
      file: file.path,
      readBy: 'everywhere' as const,
    })),
  );
}
