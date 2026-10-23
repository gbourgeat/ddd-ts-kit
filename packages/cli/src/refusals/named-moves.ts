import { toName } from '../naming/index.js';
import type { ConceptErrorClass } from './concept-error-class.js';
import type { LegacyError } from './legacy-error.js';
import { legacyMove } from './legacy-move.js';
import type { MigrationDraft } from './migration-draft.js';
import type { NamedMove } from './named-move.js';
import type { NamedPlan } from './named-plan.js';
import { ownFactory } from './own-factory.js';
import { pathFromContexts } from './path-from-contexts.js';
import type { PlannedRefusal } from './planned-refusal.js';
import type { RefusalSources } from './propose-named-plan.js';
import { renderFactory } from './render-factory.js';

const IMPORT = /^import [^;]+;\n/gm;

/**
 * The refusals still there whose plan entry names their class: each one with the factory it gets.
 * One that cannot move mechanically is said, and left.
 */
export function namedMoves(plan: NamedPlan, sources: RefusalSources, draft: MigrationDraft): NamedMove[] {
  return Object.entries(plan.contexts).flatMap(([context, entries]) =>
    entries.flatMap((entry) => {
      const concept = sources.concepts.find(
        (candidate) => candidate.context === context && candidate.file === entry.file,
      );

      const legacy = sources.legacy.find(
        (candidate) =>
          candidate.context === context && candidate.file === entry.file && candidate.className === entry.from,
      );

      if (legacy !== undefined) {
        return fromLegacy({ entry, error: legacy }, draft);
      }

      return concept === undefined ? [] : fromConcept({ entry, concept }, draft);
    }),
  );
}

function fromConcept(
  { entry, concept }: { entry: PlannedRefusal; concept: ConceptErrorClass },
  draft: MigrationDraft,
): NamedMove[] {
  const factory = concept.factories.find((candidate) => `${concept.className}.${candidate.name}` === entry.from);

  if (factory === undefined || factory.code === undefined) {
    draft.manual.push(
      ...(factory?.manual === undefined ? [] : [`${concept.file}: ${entry.from} is left as it is, ${factory.manual}.`]),
    );

    return [];
  }

  const target = { oldClass: concept.className, className: entry.class, factory: entry.factory };

  return [
    {
      ...movedFrom(concept, entry),
      oldClass: concept.className,
      oldFactory: factory.name,
      code: factory.code,
      text: ownFactory(factory, target),
      imports: concept.imports,
    },
  ];
}

function fromLegacy(
  { entry, error }: { entry: PlannedRefusal; error: LegacyError },
  draft: MigrationDraft,
): NamedMove[] {
  if (error.manual !== undefined) {
    draft.manual.push(`${error.file}: ${error.className} is left as it is, ${error.manual}.`);

    return [];
  }

  const head = { ...movedFrom(error, entry), oldClass: error.className, oldFactory: undefined, code: error.code };
  const text = renderFactory(error, legacyMove({ ...head, text: '', imports: [] }));

  for (const property of error.properties) {
    draft.manual.push(
      `${error.className}.${property} was a property of the error: read \`error.facts.${property}\` where it was read.`,
    );
  }

  if (error.parameters.length > 3) {
    draft.manual.push(`${entry.class}.${entry.factory} takes more than three parameters, give it one typed object.`);
  }

  return [{ ...head, text, imports: draft.read(error.file)?.match(IMPORT) ?? [] }];
}

type Head = Omit<NamedMove, 'oldClass' | 'oldFactory' | 'code' | 'text' | 'imports'>;

function movedFrom(origin: { file: string; context: string }, entry: PlannedRefusal): Head {
  return {
    context: origin.context,
    from: entry.from,
    oldFile: origin.file,
    oldPath: pathFromContexts(origin.file, origin.context),
    className: entry.class,
    classFile: `${toName(entry.class).kebab}.error`,
    factory: entry.factory,
  };
}
