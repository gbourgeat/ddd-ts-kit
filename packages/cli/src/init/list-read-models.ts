import { specifierOf } from '../alias';
import { isSource } from '../check/project/is-source';
import { loadSourceFile } from '../check/project/load-source-file';
import type { SourceFile } from '../check/model/source-file';
import type { Config } from '../config';
import { ownEntry } from '../config/values/own-entry';
import { applyWiring } from '../generate/apply-wiring';
import { filesUnder } from '../generate/files-under';
import { listReadModel } from '../generate/kinds/read-model/list-read-model';
import { declaredClassesOf } from '../read-models/declared-classes-of';
import { listHolds } from '../read-models/list-holds';
import { readModelListOf } from '../read-models/read-model-list-of';
import type { ReadModelStore } from '../read-models/read-model-store';
import { readModelStoresOf } from '../read-models/read-model-stores-of';
import type { Workspace } from '../workspace';

/**
 * The read model stores the tree holds join the list the application checks when it starts
 * (`<platformDir>/database/read-model-tables.ts`): a project generated before the list existed,
 * or whose list was emptied, would otherwise start and pass `db:read-models` with nothing
 * checked. The stores are those `persistence/read-model-listed` of the checker reads, by the
 * same reading (`readModelStoresOf`): a class of a declared context over the store of the kit of
 * one of the four ORM, directly or through classes of the project. One whose own constructor is
 * the generated one is listed under its context, under an alias when another context holds a
 * class of that name. Any other (a constructor that takes something else or is inherited, a
 * generic class, a class its file does not export) is named in `NOT_LISTED`, which the check
 * tells at each start, with a note that says what to write. An abstract class is no store to
 * build. What the list already answers for is left as it is, a store that a listed class extends
 * (the class written beside it to build it) and `<context>: <Store>` in a comment included: that is how a store left out on purpose
 * stays out.
 */
export function listReadModels(ws: Workspace, config: Config): void {
  const list = `${config.platformDir}/database/read-model-tables.ts`;

  if (!ws.exists(list)) {
    return;
  }

  const classes = declaredClassesOf(sourcesOf(ws, config, list));

  for (const store of buildableFirst(readModelStoresOf(classes))) {
    const held = readModelListOf(config, loadSourceFile(config, list, ws.read(list) ?? ''));

    if (ownEntry(config.contexts, store.context) === undefined || listHolds(held, classes, store)) {
      continue;
    }

    if (store.listable) {
      listReadModel(ws, list, { context: store.context, store: store.name, from: specifierOf(config, store.file) });
    } else {
      leaveOut(ws, list, store);
    }
  }
}

/** A class written to build a store joins the list before that store is judged, which the list then answers for. */
function buildableFirst(stores: readonly ReadModelStore[]): ReadModelStore[] {
  return [...stores.filter((store) => store.listable), ...stores.filter((store) => !store.listable)];
}

/** The sources of the project, on disk or planned, and the list wherever the platform is. */
function sourcesOf(ws: Workspace, config: Config, list: string): SourceFile[] {
  const files = filesUnder(ws, config.sourceRoot)
    .filter(isSource)
    .map((file) => `${config.sourceRoot}/${file}`);

  return [...new Set([...files, list])].map((file) => loadSourceFile(config, file, ws.read(file) ?? ''));
}

/** A store the list cannot build with certainty is named among those not listed, once, with what to write. */
function leaveOut(ws: Workspace, list: string, { context, file, name }: ReadModelStore): void {
  applyWiring(ws, list, `@@read-models-not-listed\n'${context}: ${name}',\n`);

  ws.note(
    `${name} (${file}) is a read model store this command cannot list with certainty: its own constructor is not \`(database)\` nor \`(database, scope)\`, or the class is generic. ${list} names it in NOT_LISTED, and the check of the read model tables says at each start that nothing checks its table. Write beside it a class that builds it, with the constructor of a generated store, \`export class Listed${name} extends ${name} { constructor(database: ..) { super(..); } }\`: \`init\` lists that class, the list then answers for ${name}, and its line of NOT_LISTED is yours to remove; to leave it out on purpose, replace that line by a comment that holds \`${context}: ${name}\` and the reason.`,
  );
}
