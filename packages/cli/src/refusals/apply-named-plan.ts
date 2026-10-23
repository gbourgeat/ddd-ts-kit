import { CONFIG_FILE, type Config, editConfigText } from '../config/index.js';
import type { Workspace } from '../workspace/index.js';
import type { AppliedMoves } from './applied-moves.js';
import { conceptErrors } from './concept-errors.js';
import { concerns } from './concerns.js';
import { earlierGuidance } from './earlier-guidance.js';
import { ignoreCodeTypes } from './ignore-code-types.js';
import { leaveOrigins } from './leave-origins.js';
import { legacyErrors } from './legacy-errors.js';
import type { MigrationDraft } from './migration-draft.js';
import { moveNamedSpecs } from './move-named-specs.js';
import type { NamedMove } from './named-move.js';
import { namedMoves } from './named-moves.js';
import type { NamedPlan } from './named-plan.js';
import { projectSources } from './project-sources.js';
import { refuseScattered } from './refuse-scattered.js';
import { rewriteNamedUsages } from './rewrite-named-usages.js';
import { sayRefusals } from './say-refusals.js';
import { staleMentions } from './stale-mentions.js';
import { writeRefusalClasses } from './write-refusal-classes.js';

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
