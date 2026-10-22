import type { ConceptErrorClass } from './concept-error-class';
import { cutFactories } from './cut-factories';
import type { MigrationDraft } from './migration-draft';
import type { NamedMove } from './named-move';
import type { RefusalSources } from './propose-named-plan';

/**
 * Removes what the moves leave: each class per error goes, and each concept class loses the
 * factories that moved; one left empty goes, one that keeps factories is said. Answers the
 * concept classes that are gone, which nothing may name any more.
 */
export function leaveOrigins(moves: readonly NamedMove[], sources: RefusalSources, draft: MigrationDraft): Set<string> {
  const gone = new Set<string>();

  for (const move of moves.filter((candidate) => candidate.oldFactory === undefined)) {
    draft.remove(move.oldFile);
  }

  for (const concept of sources.concepts) {
    const moved = new Set(moves.filter((move) => move.oldFile === concept.file).map((move) => move.oldFactory));

    if (moved.size > 0) {
      const kept = cutConcept(concept, moved, draft);

      if (kept === undefined) {
        gone.add(concept.className);
      }
    }
  }

  return gone;
}

function cutConcept(
  concept: ConceptErrorClass,
  moved: ReadonlySet<string | undefined>,
  draft: MigrationDraft,
): string | undefined {
  const leaving = concept.factories.filter((factory) => moved.has(factory.name));
  const staying = concept.factories.filter((factory) => !moved.has(factory.name));
  const kept = cutFactories(draft.read(concept.file) ?? '', concept.className, leaving);

  if (kept === undefined) {
    draft.remove(concept.file);

    return undefined;
  }

  draft.write(concept.file, kept);

  draft.manual.push(
    `${concept.file}: ${concept.className} keeps ${staying.map((factory) => factory.name).join(', ') || 'members of its own'}: give each refusal it builds a class of its own by hand, then remove it.`,
  );

  return kept;
}
