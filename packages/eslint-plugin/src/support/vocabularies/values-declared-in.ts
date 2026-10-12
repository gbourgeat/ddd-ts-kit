import type { Location } from '../../project/location.js';
import type { DeclaredValue } from './declared-value.js';

const AS_CONST = /export\s+const\s+([A-Z][\w$]*)\s*=\s*\{([^{}]*)\}\s*as\s+const\s*;/g;
const ENTRY = /^\s*([A-Za-z_$][\w$]*)\s*:\s*'([^'\\]*)'\s*$/;

const PERMISSION_SET =
  /export\s+const\s+([a-z][\w$]*)\s*=\s*definePermissions\(\s*'([a-z0-9-]+)'\s*,\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;

const PERMISSION_KEY = /'([a-z0-9.-]+)'\s*:/g;

/**
 * The values one source declares: the entries of an object `as const` of string values next to
 * the union type of the same name, and the ids of a permission set (`definePermissions('billing',
 * { 'invoice.issue': .. })` declares `billing:invoice.issue`), each with its value.
 */
export function valuesDeclaredIn(file: Declaring, text: string): [string, DeclaredValue][] {
  return [...objectValues(file, text), ...permissionValues(file.path, text)];
}

/** A source of the project: its path from the root, and where it stands. */
export interface Declaring {
  readonly path: string;
  readonly location: Location;
}

function objectValues(file: Declaring, text: string): [string, DeclaredValue][] {
  return [...text.matchAll(AS_CONST)].flatMap((found) => {
    const name = found[1] ?? '';

    const entries = (found[2] ?? '')
      .split(',')
      .filter((entry) => entry.trim().length > 0)
      .map((entry) => ENTRY.exec(entry));

    if (!hasUnionType(text, name) || entries.length === 0 || entries.some((entry) => entry === null)) {
      return [];
    }

    const declared = { vocabulary: name, file: file.path, readBy: readerOf(file.location) };

    return entries.flatMap((entry): [string, DeclaredValue][] =>
      entry === null ? [] : [[entry[2] ?? '', { ...declared, written: `${name}.${entry[1] ?? ''}` }]],
    );
  });
}

/** A context speaks its own language; the shared kernel is read by every layer; the platform by itself and by the edges of the contexts. */
function readerOf(location: Location): DeclaredValue['readBy'] {
  if (location.area === 'context') {
    return { context: location.context };
  }

  return location.area === 'shared-kernel' ? 'everywhere' : 'platform';
}

function hasUnionType(text: string, name: string): boolean {
  return new RegExp(
    `export\\s+type\\s+${name}\\s*=\\s*\\(\\s*typeof\\s+${name}\\s*\\)\\s*\\[\\s*keyof\\s+typeof\\s+${name}\\s*\\]`,
  ).test(text);
}

function permissionValues(file: string, text: string): [string, DeclaredValue][] {
  return [...text.matchAll(PERMISSION_SET)].flatMap(([, set = '', context = '', body = '']) =>
    [...body.matchAll(PERMISSION_KEY)].map(([, key = '']): [string, DeclaredValue] => [
      `${context}:${key}`,
      { written: `${set}['${key}']`, vocabulary: set, file, readBy: 'everywhere' },
    ]),
  );
}
