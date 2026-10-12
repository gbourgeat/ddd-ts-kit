import type { SourceFile } from '../model/source-file.js';
import { matchingBracket } from '../text/matching-bracket.js';
import type { DeclaredValue } from './declared-value.js';

const AS_CONST = /export\s+const\s+([A-Z][\w$]*)\s*=\s*\{([^{}]*)\}\s*as\s+const\s*;/g;
const ENTRY = /^\s*([A-Za-z_$][\w$]*)\s*:\s*'([^'\\]*)'\s*$/;
const PERMISSION_SET = /export\s+const\s+([a-z][\w$]*)\s*=\s*definePermissions\(\s*'([a-z0-9-]+)'\s*,\s*\{/g;
const PERMISSION_KEY = /'([a-z0-9.-]+)'\s*:/g;

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
  return [...file.text.matchAll(AS_CONST)].flatMap((found) => {
    const name = found[1] ?? '';

    const entries = (found[2] ?? '')
      .split(',')
      .filter((entry) => entry.trim().length > 0)
      .map((entry) => ENTRY.exec(entry));

    if (!hasUnionType(file.text, name) || entries.length === 0 || entries.some((entry) => entry === null)) {
      return [];
    }

    const declared = { vocabulary: name, file: file.path, readBy: readerOf(file) };

    return entries.flatMap((entry) =>
      entry === null ? [] : [{ ...declared, value: entry[2] ?? '', written: `${name}.${entry[1] ?? ''}` }],
    );
  });
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
  return [...file.text.matchAll(PERMISSION_SET)].flatMap((found) => {
    const [, set = '', context = ''] = found;
    const open = found.index + found[0].length - 1;
    const body = file.text.slice(open, matchingBracket(file.scan.code, open));

    return [...body.matchAll(PERMISSION_KEY)].map(([, key = '']) => ({
      value: `${context}:${key}`,
      written: `${set}['${key}']`,
      vocabulary: set,
      file: file.path,
      readBy: 'everywhere' as const,
    }));
  });
}
