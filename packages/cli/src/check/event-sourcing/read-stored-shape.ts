import { createHash } from 'node:crypto';
import type { Scan } from '../scan/scan';
import { declaredShape, type ShapeReading } from './declared-shape';
import type { StoredShape } from './stored-shape';

/** The fingerprint of a shape of no member: the hash of empty input, which vouches for nothing. */
export const EMPTY_SHAPE_FINGERPRINT = digest([], []);

/**
 * Stored shapes the kit itself owns and keeps readable across its releases: named in a data
 * type, they are not declared in the codec file.
 */
const KIT_STORED_TYPES = new Set(['PersonalValue']);

/**
 * The shape a type declares in the file, with the shapes of the named types it reaches that the
 * same file declares: members of each body, comments left out, whitespace outside literals
 * removed, sorted. Two declarations of the same fields have the same fingerprint whatever their
 * layout and order; any other change of a field, of its type, of a literal in it or of a type it
 * names gives another one. A named type the file does not declare is listed as unresolved: its
 * changes would not move the fingerprint. `undefined` when the file declares no such type.
 */
export function readStoredShape(scan: Scan, typeName: string): StoredShape | undefined {
  const current = fingerprinted(scan, typeName, 'current');

  if (current === undefined) {
    return undefined;
  }

  const former = fingerprinted(scan, typeName, '0.82')?.fingerprint;

  return { ...current, formerFingerprint: former === current.fingerprint ? undefined : former };
}

function fingerprinted(
  scan: Scan,
  typeName: string,
  reading: ShapeReading,
): Omit<StoredShape, 'formerFingerprint'> | undefined {
  const root = declaredShape(scan, typeName, reading);

  if (root === undefined) {
    return undefined;
  }

  const nested: string[] = [];
  const unresolved: string[] = [];
  const seen = new Set([typeName]);
  const pending = [...root.references];

  for (let name = pending.shift(); name !== undefined; name = pending.shift()) {
    if (seen.has(name) || KIT_STORED_TYPES.has(name)) {
      continue;
    }

    seen.add(name);

    const shape = declaredShape(scan, name, reading);

    if (shape === undefined) {
      unresolved.push(name);
    } else {
      nested.push(`${name}=${shape.members.join(';')}`);
      pending.push(...shape.references);
    }
  }

  return { fingerprint: digest(root.members, nested), empty: root.members.length === 0, unresolved };
}

/** A shape that names no type of the file keeps the digest of its members alone. */
function digest(members: readonly string[], nested: readonly string[]): string {
  const text = nested.length === 0 ? members.join(';') : `${members.join(';')}|${[...nested].sort().join('|')}`;

  return `sha256:${createHash('sha256').update(text).digest('hex').slice(0, 16)}`;
}
