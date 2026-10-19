import { escapeRegExp } from '../check/text/escape-reg-exp.js';
import type { Config } from '../config/index.js';
import { addSpecCase } from '../generate/errors/add-spec-case.js';
import type { ConceptErrorClass } from './concept-error-class.js';
import { importsUsedBy } from './imports-used-by.js';
import { legacyMove } from './legacy-move.js';
import type { MigrationDraft } from './migration-draft.js';
import type { NamedMove } from './named-move.js';
import type { RefusalSources } from './propose-named-plan.js';
import { renameConcept } from './rename-concept.js';
import { rewriteNamedUsages } from './rewrite-named-usages.js';
import { rewriteUsages } from './rewrite-usages.js';
import { specParts } from './spec-parts.js';
import { type SplitSpec, splitConceptSpec } from './split-concept-spec.js';
import { withImports } from './with-imports.js';

const IMPORT = /^import [^;]+;\n/gm;

/** The moves of a plan to the named form, and what the refusals were built with before. */
interface Moved {
  readonly moves: readonly NamedMove[];
  readonly sources: RefusalSources;
}

/**
 * The spec of each class per error becomes the spec of its class of its own; the spec of each
 * concept class is cut, each case going to the spec of the class whose refusal it builds.
 */
export function moveNamedSpecs(config: Config, { moves, sources }: Moved, draft: MigrationDraft): void {
  const unit = (context: string): string => `${config.contextsDir}/${context}/test/unit`;

  for (const move of moves.filter((candidate) => candidate.oldFactory === undefined)) {
    moveLegacySpec(unit(move.context), move, draft);
  }

  for (const concept of sources.concepts) {
    const own = moves.filter((move) => move.oldFile === concept.file);
    const spec = `${unit(concept.context)}/${specName(concept.file)}`;

    if (own.length > 0) {
      splitSpec(
        { spec, unit: unit(concept.context), concept },
        { own, all: moves.filter((move) => move.context === concept.context) },
        draft,
      );
    }
  }
}

/**
 * The spec of a class per error, rewritten as any other file, is the spec of its class of its own,
 * under its name. One that cannot be merged into the spec already there stays, said.
 */
function moveLegacySpec(unit: string, move: NamedMove, draft: MigrationDraft): void {
  const old = `${unit}/${specName(move.oldFile)}`;
  const target = `${unit}/${move.classFile}.spec.ts`;
  const source = draft.read(old);

  if (source === undefined) {
    return;
  }

  const describe = new RegExp(`describe\\(\\s*(['"])${escapeRegExp(move.oldClass)}\\1`);
  const rewritten = rewriteUsages(source, [legacyMove(move)]).replace(describe, `describe('${move.className}'`);

  if (target === old) {
    draft.write(old, rewritten);
  } else if (mergeSpec({ target, from: old }, rewritten, draft)) {
    draft.remove(old);
  }
}

interface Where {
  readonly spec: string;
  readonly unit: string;
  readonly concept: ConceptErrorClass;
}

interface Moves {
  readonly own: readonly NamedMove[];
  readonly all: readonly NamedMove[];
}

/**
 * Each case of the spec of a concept class goes to the spec of the class it builds; a case whose
 * class has a spec without a `describe` to take it stays, said.
 */
function splitSpec({ spec, unit, concept }: Where, moves: Moves, draft: MigrationDraft): void {
  const specOf = (className: string): string =>
    `${unit}/${moves.own.find((move) => move.className === className)?.classFile ?? ''}.spec.ts`;

  const takes = (className: string): boolean => takesCases(draft.read(specOf(className)));
  const source = draft.read(spec);
  const split = source === undefined ? undefined : splitConceptSpec(source, moves.own, takes);

  if (source !== undefined && split === undefined) {
    draft.manual.push(
      `${spec}: its cases share a setup or code around them: move each one to the spec of its refusal class by hand.`,
    );
  }

  if (split === undefined) {
    return;
  }

  giveCases({ spec, concept: concept.className, specOf, split }, moves, draft);

  if (split.rest === undefined) {
    draft.remove(spec);
  } else {
    draft.write(spec, split.rest);
  }
}

/** The spec of a concept class, cut, and where the spec of each class of its own is. */
interface Cut {
  readonly spec: string;
  readonly concept: string;
  readonly specOf: (className: string) => string;
  readonly split: SplitSpec;
}

/** Each class of its own takes its cases in its spec; the cases of one whose spec takes none stay, said. */
function giveCases({ spec, concept, specOf, split }: Cut, moves: Moves, draft: MigrationDraft): void {
  for (const className of split.left) {
    draft.manual.push(
      `${specOf(className)}: no describe block was found, move the cases of ${className} from ${spec} to it by hand.`,
    );
  }

  for (const [className, cases] of split.cases) {
    const ofClass = moves.own.filter((move) => move.className === className);
    const text = classSpec({ imports: split.imports, className, cases }, { own: ofClass, all: moves.all }, concept);

    mergeSpec({ target: specOf(className), from: spec }, text, draft);
  }
}

interface Cases {
  readonly imports: readonly string[];
  readonly className: string;
  readonly cases: readonly string[];
}

/** The spec of one class of its own, from the cases of the spec of its concept class: a `describe` of a factory takes its new name. */
function classSpec({ imports, className, cases }: Cases, moves: Moves, concept: string): string {
  const titled = cases.map((text) =>
    moves.own.reduce(
      (current, move) =>
        current.replace(
          new RegExp(`describe\\(\\s*(['"])${escapeRegExp(move.oldFactory ?? '')}\\1`),
          `describe('${move.factory}'`,
        ),
      text,
    ),
  );

  const candidate = `${imports.join('')}\ndescribe('${className}', () => {\n${titled.join('\n\n')}\n});\n`;

  const rewritten = renameConcept(
    rewriteNamedUsages(candidate, { moves: moves.all, gone: new Set() }),
    concept,
    className,
  );

  const body = rewritten.replace(IMPORT, '');

  return importsUsedBy(rewritten.match(IMPORT) ?? [], body).join('') + body;
}

interface Merge {
  readonly target: string;
  /** The spec the cases come from. */
  readonly from: string;
}

/**
 * A spec written where one already is gives it its cases and the imports they read. False, said,
 * when either has no `describe`: the cases are then merged by hand, nothing is lost.
 */
function mergeSpec({ target, from }: Merge, text: string, draft: MigrationDraft): boolean {
  const existing = draft.read(target);
  const { imports, cases } = specParts(text);

  if (existing === undefined) {
    draft.write(target, text);

    return true;
  }

  const merged = cases === undefined ? undefined : addSpecCase(withImports(existing, imports), cases, cases);

  if (merged === undefined) {
    draft.manual.push(
      cases === undefined
        ? `${from}: no describe block was found, move its cases to ${target} by hand.`
        : `${target}: no describe block was found, move the cases of ${from} to it by hand.`,
    );

    return false;
  }

  draft.write(target, merged);

  return true;
}

/** A spec takes cases when there is none yet, or when it has a `describe` to hold them. */
function takesCases(spec: string | undefined): boolean {
  return spec === undefined || specParts(spec).cases !== undefined;
}

function specName(file: string): string {
  return file.slice(file.lastIndexOf('/') + 1).replace(/\.ts$/, '.spec.ts');
}
