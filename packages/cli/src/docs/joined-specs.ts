import type { UseCaseFact } from '../describe/context-description';
import { allRules } from './all-rules';
import { citedRows } from './cited-rows';
import { isEmptyRules } from './is-empty-rules';
import { kebabOfUseCase } from './kebab-of-use-case';
import type { SpecOfPage } from './page-section';
import { rulesWhere } from './rules-where';
import { specSubject } from './spec-subject';
import { useCaseOfSpec } from './use-case-of-spec';
import type { UseCasesOfContext } from './use-cases-of-context';

/** A context as the specs of the application are shared out under its use cases. */
export interface UseCasesAndSpecs {
  readonly context: string;
  readonly known: UseCasesOfContext;
  readonly specs: readonly SpecOfPage[];
}

/** The specs of the application shared out: those of each use case, by context then by use case, and what stays on the page of the application. */
export interface JoinedSpecs {
  readonly byContext: ReadonlyMap<string, ReadonlyMap<string, readonly SpecOfPage[]>>;
  readonly left: readonly SpecOfPage[];
}

interface Owner {
  readonly context: string;
  readonly useCase: UseCaseFact;
}

type ByContext = Map<string, Map<string, SpecOfPage[]>>;

/**
 * Shares out the specs of the application (`test/`, files relative to it) under the use cases of
 * the contexts: an end-to-end spec named after a use case or its route (`<use-case>`,
 * `<use-case>-<behaviour>`, `<context>-<use-case>`), the longest name winning and a tie leaving it
 * where it is; an acceptance scenario under the use case whose titles cite the first row it cites.
 * Every other spec and scenario stays on the page of the application.
 */
export function joinedSpecs(contexts: readonly UseCasesAndSpecs[], application: readonly SpecOfPage[]): JoinedSpecs {
  const byContext: ByContext = new Map();
  const left: SpecOfPage[] = [];

  for (const spec of application.filter((candidate) => specSubject(candidate.file).role === 'e2e')) {
    const owner = ownerByName(contexts, specSubject(spec.file).subject);

    if (owner === undefined) {
      left.push(spec);
    } else {
      add(byContext, owner, spec);
    }
  }

  const rows = rowsByOwner(contexts, byContext);

  for (const spec of application.filter((candidate) => specSubject(candidate.file).role !== 'e2e')) {
    left.push(...shareScenarios(byContext, spec, rows));
  }

  return { byContext, left };
}

/** A spec of the application on the page of a context is named from the project root. */
function add(byContext: ByContext, { context, useCase }: Owner, spec: SpecOfPage): void {
  const ofContext = byContext.get(context) ?? new Map<string, SpecOfPage[]>();

  ofContext.set(useCase.name, [...(ofContext.get(useCase.name) ?? []), { ...spec, file: `test/${spec.file}` }]);
  byContext.set(context, ofContext);
}

/** The scenarios of an acceptance spec under the use case of the first row each one cites; what is left of the spec, any other spec whole. */
function shareScenarios(
  byContext: ByContext,
  spec: SpecOfPage,
  rows: readonly (readonly [ReadonlySet<string>, Owner])[],
): SpecOfPage[] {
  if (specSubject(spec.file).role !== 'acceptance') {
    return [spec];
  }

  const ownerOf = (title: string): Owner | undefined => {
    const [first = ''] = citedRows(title).rows;

    return rows.find(([cited]) => cited.has(first))?.[1];
  };

  for (const owner of new Set(allRules(spec.rules).flatMap((rule) => ownerOf(rule.title) ?? []))) {
    add(byContext, owner, { ...spec, rules: rulesWhere(spec.rules, (rule) => ownerOf(rule.title) === owner) });
  }

  const rest = rulesWhere(spec.rules, (rule) => ownerOf(rule.title) === undefined);

  return isEmptyRules(rest) ? [] : [{ ...spec, rules: rest }];
}

/** The use case an end-to-end spec is named after, when one name of one context is the longest that fits. */
function ownerByName(contexts: readonly UseCasesAndSpecs[], name: string): Owner | undefined {
  const fits = (prefix: string): boolean => name === prefix || name.startsWith(`${prefix}-`);

  const candidates = contexts.flatMap(({ context, known }) =>
    known.useCases.flatMap((useCase) =>
      namesOf(known, useCase)
        .flatMap((named) => [named, `${context}-${named}`])
        .filter(fits)
        .map((prefix) => ({ owner: { context, useCase }, length: prefix.length })),
    ),
  );

  const longest = Math.max(0, ...candidates.map((candidate) => candidate.length));

  const best = new Map(
    candidates
      .filter((candidate) => candidate.length === longest)
      .map(({ owner }) => [`${owner.context}/${owner.useCase.name}`, owner]),
  );

  return best.size === 1 ? [...best.values()][0] : undefined;
}

/** The names a use case goes by: its own, and that of each route that sends it (`export-practice-agenda` for a search). */
function namesOf({ routes }: UseCasesOfContext, useCase: UseCaseFact): string[] {
  const routed = routes
    .filter((route) => route.useCase === useCase.name)
    .map((route) => route.file.slice(route.file.lastIndexOf('/') + 1).replace(/\.(controller|route)\.ts$/, ''));

  return [...new Set([kebabOfUseCase(useCase), ...routed])];
}

/** The rows the titles of each use case cite, its own specs and its end-to-end specs, in the order of the contexts. */
function rowsByOwner(contexts: readonly UseCasesAndSpecs[], joined: ByContext): [ReadonlySet<string>, Owner][] {
  return contexts.flatMap(({ context, known, specs }) =>
    known.useCases.map((useCase): [ReadonlySet<string>, Owner] => {
      const own = specs.filter((spec) => useCaseOfSpec(known, specSubject(spec.file)) === useCase);
      const theirs = [...own, ...(joined.get(context)?.get(useCase.name) ?? [])];
      const titles = theirs.flatMap((spec) => allRules(spec.rules)).map((rule) => rule.title);

      return [new Set(titles.flatMap((title) => citedRows(title).rows)), { context, useCase }];
    }),
  );
}
