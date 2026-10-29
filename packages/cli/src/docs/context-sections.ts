import type { UseCaseFact } from '../describe/context-description';
import { toName } from '../naming';
import type { PageEntry, PageSection, SpecOfPage } from './page-section';
import { MODEL_ROLES, REACTION_ROLES, SPEC_ROLES, USE_CASE_ROLES } from './spec-roles';
import { specSubject } from './spec-subject';
import { useCaseOfSpec } from './use-case-of-spec';
import type { UseCasesOfContext } from './use-cases-of-context';
import { specsByDirectory } from './specs-by-directory';

/** What the page of a context is made of. */
export interface SpecsOfContext {
  readonly context: string;
  readonly known: UseCasesOfContext;
  /** Its specs, from its `test/` directory. */
  readonly specs: readonly SpecOfPage[];
  /** The specs of the application that state the rules of one of its use cases, by the name of the use case: end to end, acceptance. */
  readonly joined: ReadonlyMap<string, readonly SpecOfPage[]>;
}

/**
 * The sections of the page of a context, read as a specification: one heading per use case with
 * the specs of its handler, policy, controller or route, reader, end to end and acceptance; one per
 * part of the model; one per reaction; then each spec that fits none, under its directory.
 */
export function contextSections({ context, known, specs, joined }: SpecsOfContext): PageSection[] {
  const { useCases, model, reactions, others } = sharedOut(known, specs);

  for (const useCase of known.useCases) {
    const theirs = joined.get(useCase.name) ?? [];

    if (theirs.length > 0) {
      useCases.set(useCase, [...(useCases.get(useCase) ?? []), ...theirs]);
    }
  }

  return [
    { title: 'Use cases', entries: useCaseEntries(context, useCases) },
    { title: 'Model', entries: orderedBy(model, MODEL_ROLES) },
    { title: 'Reactions', entries: orderedBy(reactions, REACTION_ROLES) },
    ...specsByDirectory(others),
  ];
}

interface SharedOut {
  readonly useCases: Map<UseCaseFact, SpecOfPage[]>;
  readonly model: Map<string, Placed>;
  readonly reactions: Map<string, Placed>;
  readonly others: SpecOfPage[];
}

/** The specs of the context by what they state the rules of: a use case, a part of the model, a reaction, or none of them. */
function sharedOut(known: UseCasesOfContext, specs: readonly SpecOfPage[]): SharedOut {
  const shared: SharedOut = { useCases: new Map(), model: new Map(), reactions: new Map(), others: [] };

  for (const spec of specs) {
    const subject = specSubject(spec.file);
    const useCase = useCaseOfSpec(known, subject);
    const role = subject.role ?? '';

    const parts = MODEL_ROLES.includes(role)
      ? shared.model
      : REACTION_ROLES.includes(role)
        ? shared.reactions
        : undefined;

    if (useCase !== undefined) {
      shared.useCases.set(useCase, [...(shared.useCases.get(useCase) ?? []), spec]);
    } else if (parts === undefined) {
      shared.others.push(spec);
    } else {
      placeIn(parts, spec, SPEC_ROLES[role] ?? role);
    }
  }

  return shared;
}

interface Placed {
  readonly role: string;
  readonly heading: string;
  readonly specs: SpecOfPage[];
}

/** A part of the model or a reaction, its specs under one heading: `Slot (value object), in calendars`. */
function placeIn(parts: Map<string, Placed>, spec: SpecOfPage, word: string): void {
  const { subject, role = '', folder } = specSubject(spec.file);
  const heading = `${toName(subject).title} (${word})${inModule(folder)}`;
  const placed = parts.get(heading) ?? { role, heading, specs: [] };

  placed.specs.push(spec);
  parts.set(heading, placed);
}

function orderedBy(parts: ReadonlyMap<string, Placed>, roles: readonly string[]): PageEntry[] {
  return [...parts.values()]
    .sort(
      (left, right) =>
        roles.indexOf(left.role) - roles.indexOf(right.role) || left.heading.localeCompare(right.heading),
    )
    .map(({ heading, specs }) => ({ heading, specs }));
}

/** One heading per use case that has a spec, the command or query in the words `describe` prints it with: `Cancel invoice (command)`. */
function useCaseEntries(context: string, useCases: ReadonlyMap<UseCaseFact, readonly SpecOfPage[]>): PageEntry[] {
  return [...useCases]
    .map(([useCase, specs]) => ({ module: moduleOf(context, useCase), useCase, specs }))
    .sort(
      (left, right) =>
        (left.module ?? '').localeCompare(right.module ?? '') || left.useCase.name.localeCompare(right.useCase.name),
    )
    .map(({ module, useCase, specs }) => ({
      heading: `${toName(useCase.name).title} (${useCase.kind})${module === undefined ? '' : `, in ${module}`}`,
      specs: [...specs].sort(byRole),
    }));
}

function byRole(left: SpecOfPage, right: SpecOfPage): number {
  const rank = (spec: SpecOfPage): number => USE_CASE_ROLES.indexOf(specSubject(spec.file).role ?? '');

  return rank(left) - rank(right) || left.file.localeCompare(right.file);
}

/** The module of the model a use case belongs to: the folder above its `application/`, when it is not the context. */
function moduleOf(context: string, useCase: UseCaseFact): string | undefined {
  const segments = useCase.file.split('/');
  const above = segments[segments.lastIndexOf('application') - 1];

  return above === undefined || above === context ? undefined : above;
}

/** `unit/calendars` reads `, in calendars`: the module folder of a test folder. */
function inModule(folder: string): string {
  const module = folder.split('/').slice(1).join('/');

  return module === '' ? '' : `, in ${module}`;
}
