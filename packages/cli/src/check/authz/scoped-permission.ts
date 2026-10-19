import type { SourceFile } from '../model/source-file.js';
import { escapeRegExp } from '../text/escape-reg-exp.js';
import type { ListPart } from '../text/list-part.js';
import type { PermissionSet } from './permission-sets.js';

/** The entry of a set, `billingPermissions[`, up to its key. */
const SET_ENTRY = /^([A-Za-z_$][\w$]*)\s*\[\s*/;
/** A name the permission may be held in: `permission`, `this.permission`. */
const HELD = /^(?:this\.)?([A-Za-z_$][\w$]*)$/;

/** A permission written as the entry of a set: the set, and the key read in it. */
export interface ScopedPermission {
  readonly set: PermissionSet;
  readonly key: string;
}

/**
 * The permission an argument names: the entry of a set written in place, or a constant or a field
 * of the same file initialised with one. Undefined when the checker cannot read it: a parameter,
 * a call, a constant of another file, an entry whose key is not a literal.
 */
export function scopedPermission(
  file: SourceFile,
  argument: ListPart,
  sets: readonly PermissionSet[],
): ScopedPermission | undefined {
  const inPlace = entryAt(file, argument, sets);

  if (inPlace !== undefined) {
    return inPlace;
  }

  const held = HELD.exec(argument.code)?.[1];

  if (held === undefined) {
    return undefined;
  }

  const declaration = new RegExp(
    `\\b(?:const|let|var|readonly|private|protected|public|static)\\s+${escapeRegExp(held)}\\b[^=;(){}]*=\\s*`,
    'g',
  );

  for (const found of file.scan.code.matchAll(declaration)) {
    const start = found.index + found[0].length;
    const entry = entryAt(file, { code: file.scan.code.slice(start, start + 200), start }, sets);

    if (entry !== undefined) {
      return entry;
    }
  }

  return undefined;
}

function entryAt(file: SourceFile, at: ListPart, sets: readonly PermissionSet[]): ScopedPermission | undefined {
  const entry = SET_ENTRY.exec(at.code);
  const set = sets.find(({ set: name }) => name === entry?.[1]);

  if (entry === null || set === undefined) {
    return undefined;
  }

  const key = file.scan.strings.find(({ start }) => start === at.start + entry[0].length)?.value;

  return key === undefined ? undefined : { set, key };
}
