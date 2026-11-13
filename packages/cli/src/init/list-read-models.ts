import { specifierOf } from '../alias';
import type { SourceFile } from '../check/model/source-file';
import { isSource } from '../check/project/is-source';
import { loadSourceFile } from '../check/project/load-source-file';
import { resolveImport } from '../check/project/resolve-import';
import type { Config } from '../config';
import { ownEntry } from '../config/values/own-entry';
import { applyWiring } from '../generate/apply-wiring';
import { filesUnder } from '../generate/files-under';
import { BUILDABLE_CONSTRUCTOR } from '../read-models/buildable-constructor';
import { DeclaredClasses } from '../read-models/declared-classes';
import { ListAnswers } from '../read-models/list-answers';
import { listingOf } from '../read-models/listing-of';
import type { ImportedClass } from '../read-models/read-model-list';
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
 * the generated one is listed under its context, under an alias when the list already binds its
 * name. Any other (a constructor that takes something else or is inherited, a generic class, a
 * class its file does not export by its name) is named in `NOT_LISTED`, which the check tells at
 * each start, with a note that says what to write. An abstract class is no store to build. What
 * the list already answers for is left as it is, a store that a listed class extends (the class
 * written beside it to build it) and `<context>: <Store>` in a comment between its markers
 * included: that is how a store left out on purpose stays out. The sources and the list are
 * read once, whatever the number of stores.
 */
export function listReadModels(ws: Workspace, config: Config): void {
  const list = `${config.platformDir}/database/read-model-tables.ts`;

  if (!ws.exists(list)) {
    return;
  }

  const sources = sourcesOf(ws, config, list);
  const classes = new DeclaredClasses(config, sources);
  const held = readModelListOf(config, loadSourceFile(config, list, ws.read(list) ?? ''));
  const answers = new ListAnswers(held, classes);
  const imports = new Map(held.imports);

  const stores = readModelStoresOf(classes).filter(({ context }) => ownEntry(config.contexts, context) !== undefined);

  // A class written to build a store joins the list before that store is judged, which the list then answers for.
  for (const store of stores.filter(({ obstacle }) => obstacle === undefined)) {
    if (!answers.holds(store)) {
      answers.listed(store.context, listStore(ws, { config, path: list, imports }, store));
    }
  }

  for (const store of stores.filter(({ obstacle }) => obstacle !== undefined)) {
    if (!answers.holds(store)) {
      leaveOut(ws, list, store);
    }
  }
}

/** The sources of the project, on disk or planned, and the list wherever the platform is. */
function sourcesOf(ws: Workspace, config: Config, list: string): SourceFile[] {
  const files = filesUnder(ws, config.sourceRoot)
    .filter(isSource)
    .map((file) => `${config.sourceRoot}/${file}`);

  return [...new Set([...files, list])].map((file) => loadSourceFile(config, file, ws.read(file) ?? ''));
}

/** The list being written: its file, and the classes it imports, those this run adds included. */
interface Written {
  readonly config: Config;
  readonly path: string;
  readonly imports: Map<string, ImportedClass>;
}

/** Writes the import and the entry of a store, and answers the name of its class. */
function listStore(ws: Workspace, { config, path, imports }: Written, store: ReadModelStore): string {
  const { context, name, file } = store;
  const from = specifierOf(config, file);
  const { imported, local, entry } = listingOf(imports, { context, store: name, file, from });

  imports.set(local, { name, target: resolveImport(config, path, from) });
  applyWiring(ws, path, `@@imports\n${imported ?? ''}\n@@contexts\n'${context}',\n@@read-model-tables\n${entry}\n`);

  return name;
}

/** A store the list cannot build with certainty is named among those not listed, once, with what to write. */
function leaveOut(ws: Workspace, list: string, { context, file, name, obstacle }: ReadModelStore): void {
  applyWiring(ws, list, `@@read-models-not-listed\n'${context}: ${name}',\n`);

  ws.note(
    `${name} (${file}) is a read model store this command cannot list with certainty: ${obstacle}. ${list} names it in NOT_LISTED, and the check of the read model tables says at each start that nothing checks its table. Write beside it, in a file of its own, a class that builds it, \`export class Listed${name} extends ${name} { constructor(database: Persistence['database']) { super(..); } }\` (its own constructor ${BUILDABLE_CONSTRUCTOR}): \`init\` lists that class, the list then answers for ${name}, and its line of NOT_LISTED is yours to remove; to leave it out on purpose, replace that line by a comment that holds \`${context}: ${name}\` and the reason, between the markers, which is all \`init --force\` keeps of the file.`,
  );
}
