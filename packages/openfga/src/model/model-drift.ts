import { canonicalModel } from './canonical-model.js';
import type { OpenFgaModel } from './open-fga-model.js';

/**
 * What differs between the model the schema generates and the one a store holds: one line per
 * type or `type#relation` missing, extra or changed. Empty when they decide alike. The store
 * holds none at all: one line says so.
 */
export function modelDrift(expected: OpenFgaModel, actual: unknown): readonly string[] {
  if (actual === undefined || actual === null) {
    return ['the store holds no authorization model'];
  }

  const wanted = canonicalModel(expected);
  const held = canonicalModel(actual);
  const names = [...new Set([...wanted.keys(), ...held.keys()])].sort();

  return names.flatMap((name) => differenceAt(name, wanted.get(name), held.get(name)));
}

function differenceAt(name: string, wanted: string | undefined, held: string | undefined): readonly string[] {
  if (wanted === held) {
    return [];
  }

  if (held === undefined) {
    return [`${name} is in the schema, not in the store: ${String(wanted)}`];
  }

  if (wanted === undefined) {
    return [`${name} is in the store, not in the schema: ${held}`];
  }

  return [`${name} differs: the schema says ${wanted}, the store ${held}`];
}
