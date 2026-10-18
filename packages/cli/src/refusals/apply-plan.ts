import { CliError } from '../cli-error.js';
import { CONFIG_FILE, editConfigText, type Config } from '../config/index.js';
import { addFactory } from '../generate/errors/add-factory.js';
import { addSpecCase } from '../generate/errors/add-spec-case.js';
import { fitSource } from '../layout/index.js';
import { toName } from '../naming/index.js';
import type { Workspace } from '../workspace/index.js';
import { legacyErrors } from './legacy-errors.js';
import { nestedCases } from './nested-cases.js';
import type { MigrationDraft } from './migration-draft.js';
import type { MigrationPlan } from './migration-plan.js';
import type { PlannedMove } from './planned-move.js';
import { projectSources } from './project-sources.js';
import { concerns } from './concerns.js';
import { sayRefusals } from './say-refusals.js';
import { renderFactory } from './render-factory.js';
import { rewriteUsages } from './rewrite-usages.js';
import { specParts } from './spec-parts.js';
import { withImports } from './with-imports.js';

interface Tree {
  readonly ws: Workspace;
  readonly config: Config;
}

/**
 * Follows the plan: each class per error becomes a factory of the error class of its concept,
 * its spec becomes cases of the spec of that class, every file that named it follows, and the
 * config says the project builds its refusals through factories. Answers the moves it made.
 */
export function applyPlan(tree: Tree, plan: MigrationPlan, draft: MigrationDraft): PlannedMove[] {
  const moves = plannedMoves(tree, plan, draft);

  for (const planned of moves) {
    moveClass(tree, planned, draft);
  }

  const all = moves.map(({ move }) => move);
  const gone = new Set(draft.removed);

  for (const file of projectSources(tree.ws, tree.config).filter((candidate) => !gone.has(candidate))) {
    const told = (className: string, conceptClass: string): void => {
      draft.manual.push(
        `${file}: ${conceptClass} stands where ${className} stood as a value: assert the code of the refusal there.`,
      );
    };

    const source = draft.read(file) ?? '';

    draft.write(
      file,
      rewriteUsages(
        source,
        all.filter((move) => concerns({ context: move.context, path: move.legacyPath }, { file, source }, tree.config)),
        told,
      ),
    );
  }

  draft.write(CONFIG_FILE, editConfigText(draft.read(CONFIG_FILE) ?? '{}', sayRefusals('factories')));

  return moves;
}

/** The classes still there whose plan entry says where they go; one that cannot move mechanically is said, and left. */
function plannedMoves({ ws, config }: Tree, plan: MigrationPlan, draft: MigrationDraft): PlannedMove[] {
  return legacyErrors(ws, config).flatMap((error) => {
    const entry = (plan.contexts[error.context] ?? []).find(
      (candidate) => candidate.class === error.className && candidate.file === error.file,
    );

    if (entry === undefined || `${entry.concept}Error` === error.className) {
      return [];
    }

    if (error.manual !== undefined) {
      draft.manual.push(`${error.file}: ${error.className} is left as it is, ${error.manual}.`);

      return [];
    }

    const move = {
      className: error.className,
      conceptClass: `${entry.concept}Error`,
      conceptFile: `${toName(entry.concept).kebab}.error`,
      factory: entry.factory,
      code: error.code,
      context: error.context,
      legacyPath: `${error.context}/domain/errors/${baseName(error.file).replace(/\.ts$/, '')}`,
    };

    return [{ error, move }];
  });
}

function moveClass({ config }: Tree, { error, move }: PlannedMove, draft: MigrationDraft): void {
  const context = `${config.contextsDir}/${error.context}`;
  const target = `${context}/domain/errors/${move.conceptFile}.ts`;
  const factory = renderFactory(error, move);
  const empty = `import { ConceptError } from '@ddd-ts-kit/kernel';\n\nexport class ${move.conceptClass} extends ConceptError {}\n`;

  const next = addFactory(draft.read(target) ?? empty, {
    className: move.conceptClass,
    name: move.factory,
    text: factory,
  });

  // The draft is not committed yet: refusing here writes nothing of the move.
  if (next === undefined) {
    throw new CliError(
      `${target} holds another class than ${move.conceptClass}.`,
      `Give ${error.className} another concept in the plan, or move what ${target} holds to a file of its own, then run \`ddd-ts-kit error-factories --apply\` again.`,
    );
  }

  if (error.parameters.length > 3) {
    draft.manual.push(
      `${target}: ${move.conceptClass}.${move.factory} takes more than three parameters, give it one typed object.`,
    );
  }

  for (const property of error.properties) {
    draft.manual.push(
      `${error.className}.${property} was a property of the error: read \`error.facts.${property}\` where it was read.`,
    );
  }

  draft.remove(error.file);
  draft.write(target, fitSource(next));
  moveSpec(context, { error, move }, draft);
}

/**
 * The spec of the class, rewritten as any other file, becomes the cases of its factory in the spec
 * of the concept class. A spec of the concept class without a `describe` takes no case: the spec of
 * the class stays, and is said.
 */
function moveSpec(context: string, { error, move }: PlannedMove, draft: MigrationDraft): void {
  const old = `${context}/test/unit/${baseName(error.file).replace(/\.ts$/, '.spec.ts')}`;
  const source = draft.read(old);

  if (source === undefined) {
    return;
  }

  const { imports, cases } = specParts(rewriteUsages(source, [move]));
  const target = `${context}/test/unit/${move.conceptFile}.spec.ts`;

  if (cases === undefined) {
    draft.manual.push(`${old}: no describe block was found, move its cases to ${target} by hand.`);

    return;
  }

  const existing = draft.read(target) ?? `${imports.join('')}\ndescribe('${move.conceptClass}', () => {\n});\n`;

  const merged = addSpecCase(
    withImports(existing, imports),
    `describe('${move.factory}'`,
    nestedCases(move.factory, cases),
  );

  if (merged === undefined) {
    draft.manual.push(`${target}: no describe block was found, move the cases of ${old} to it by hand.`);

    return;
  }

  draft.remove(old);
  draft.write(target, merged);
}

function baseName(file: string): string {
  return file.slice(file.lastIndexOf('/') + 1);
}
