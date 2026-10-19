import type { Move } from './move.js';
import type { NamedMove } from './named-move.js';

/** A class per error on its way to a class of its own, as the rewriting of its usages reads it. */
export function legacyMove(move: NamedMove): Move {
  return {
    className: move.oldClass,
    conceptClass: move.className,
    conceptFile: move.classFile,
    factory: move.factory,
    context: move.context,
    legacyPath: move.oldPath,
    code: move.code,
    ownClass: true,
  };
}
