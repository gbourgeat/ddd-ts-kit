import { CONFIG_FILE, type Config, editConfigText } from '../config';
import type { Workspace } from '../workspace';
import type { AppliedMoves } from './applied-moves';
import { conceptErrors } from './concept-errors';
import { concerns } from './concerns';
import { earlierGuidance } from './earlier-guidance';
import { ignoreCodeTypes } from './ignore-code-types';
import { leaveOrigins } from './leave-origins';
import { legacyErrors } from './legacy-errors';
import type { MigrationDraft } from './migration-draft';
import { moveNamedSpecs } from './move-named-specs';
import type { NamedMove } from './named-move';
import { namedMoves } from './named-moves';
import type { NamedPlan } from './named-plan';
import { projectSources } from './project-sources';
import { refuseScattered } from './refuse-scattered';
import { rewriteNamedUsages } from './rewrite-named-usages';
import { sayRefusals } from './say-refusals';
import { staleMentions } from './stale-mentions';
import { writeRefusalClasses } from './write-refusal-classes';

interface Tree {
  readonly ws: Workspace;
  readonly config: Config;
}

/**
 * Follows a plan to the named form: each refusal gets a class of its own, whose code is read from
 * the `codes.ts` of its context, with its factory; the classes per error go, the concept classes
 * left empty go, the specs follow, every file that named them follows, and the config says the
 * project names its refusals, as knip is told. What the guides and the documents still say of the
 * earlier form is said. Answers the moves it made.
 */
export function applyNamedPlan(tree: Tree, plan: NamedPlan, draft: MigrationDraft): NamedMove[] {
  const sources = { legacy: legacyErrors(tree.ws, tree.config), concepts: conceptErrors(tree.ws, tree.config) };
  const moves = namedMoves(plan, sources, draft);

  refuseScattered(moves.map((move) => ({ context: move.context, className: move.className, file: move.oldFile })));

  const gone = leaveOrigins(moves, sources, draft);

  writeRefusalClasses(tree.config, moves, draft);
  moveNamedSpecs(tree.config, { moves, sources }, draft);
  rewriteProject(tree, { moves, gone }, draft);
  draft.write(CONFIG_FILE, editConfigText(draft.read(CONFIG_FILE) ?? '{}', sayRefusals('named')));
  ignoreCodeTypes(tree.config, draft);
  earlierGuidance(draft);
  staleMentions(tree.ws, { moves, gone }, draft);

  return moves;
}

function rewriteProject({ ws, config }: Tree, applied: AppliedMoves, draft: MigrationDraft): void {
  const removed = new Set(draft.removed);

  for (const file of projectSources(ws, config).filter((candidate) => !removed.has(candidate))) {
    const source = draft.read(file) ?? '';

    const moves = applied.moves.filter((move) =>
      concerns({ context: move.context, path: move.oldPath }, { file, source }, config),
    );

    const told = (line: number, note: string): void => {
      draft.manual.push(`${file}:${line}: ${note}`);
    };

    draft.write(file, rewriteNamedUsages(source, { moves, gone: applied.gone }, told));
  }
}
