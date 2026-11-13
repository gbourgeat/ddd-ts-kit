import { aliasRoots, specifierSuffix, toAlias } from '../../alias';
import { CONFIG_FILE, type Config } from '../../config';
import { ownEntry } from '../../config/values/own-entry';
import { BUILDABLE_CONSTRUCTOR } from '../../read-models/buildable-constructor';
import { DeclaredClasses } from '../../read-models/declared-classes';
import { ListAnswers } from '../../read-models/list-answers';
import { listingOf } from '../../read-models/listing-of';
import type { ReadModelList } from '../../read-models/read-model-list';
import { readModelListOf } from '../../read-models/read-model-list-of';
import type { ReadModelStore } from '../../read-models/read-model-store';
import { readModelStoresOf } from '../../read-models/read-model-stores-of';
import { WITH_DATABASE } from '../../stack/with-database';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import type { Violation } from '../model/violation';
import { sourceAt } from '../project/source-at';
import { listFindings } from '../read-models/list-findings';
import { reporter } from '../support/reporter';
import { toViolations } from '../support/to-violations';

const NOTHING_CHECKS = 'nothing checks its table, at the start or before a deployment.';

export const persistenceReadModelListed: Rule = {
  id: 'persistence/read-model-listed',
  description:
    'Every read model store of a context kept in a table (a class that is not abstract over `DrizzleReadModelStore`, `KnexReadModelStore`, `PrismaReadModelStore` or `TypeOrmReadModelStore`, directly or through classes of the project) is answered for by `<platformDir>/database/read-model-tables.ts`: an entry of `LISTED` under its context names it or a class that extends it, `NOT_LISTED` names it, or a comment between the markers of the file holds `<context>: <Store>` with the reason it is left out. An entry of the list names a class that exists, under the context that declares it, and `NOT_LISTED` names no store that is gone or that `LISTED` answers for. A project on one of the four ORM that holds a store and no list is reported once.',
  scope: 'project',
  run(project) {
    const file = `${project.config.platformDir}/database/read-model-tables.ts`;
    const source = sourceAt(project, file);

    return source === undefined ? withoutList(project, file) : againstList(project, source);
  },
};

/**
 * No list: `init` wrote none before 0.112.0, and writes none without one of the four ORM, where
 * no store of the kit keeps a table and no check runs at the start. With one of them, the stores
 * of the tree are checked by nothing, which is said once, on the file that is missing.
 */
function withoutList(project: Project, file: string): Violation[] {
  const stores = readModelStoresOf(new DeclaredClasses(project.config, project.files));
  const [first] = stores;

  if (first === undefined || !WITH_DATABASE.includes(project.config.stack.orm)) {
    return [];
  }

  const others = stores.length === 1 ? '' : ` and ${stores.length - 1} more`;

  return [
    reporter(project, persistenceReadModelListed.id)(
      { file, line: 1, subjects: stores.map((store) => store.file) },
      `${first.name} of ${first.context}${others}: the project holds read model stores and no ${file}, the list of the tables the application checks when it starts.`,
      `Commit, then run \`ddd-ts-kit init --force\`: it writes ${file}, lists the stores the tree holds, and wires the check into the start and \`npm run db:read-models\`.`,
    ),
  ];
}

function againstList(project: Project, source: SourceFile): Violation[] {
  const { config } = project;
  const report = reporter(project, persistenceReadModelListed.id);
  const classes = new DeclaredClasses(config, [...new Set([...project.files, source])]);
  const answers = new ListAnswers(readModelListOf(config, source), classes);
  const { list } = answers;
  const told = toViolations(report, list.file, listFindings({ project, classes, answers }));

  if (list.unread !== undefined) {
    return [
      report(
        { file: list.file, line: list.unread },
        "`LISTED` is not an array written in the file, or holds something that is not `['<context>', <Store>]`: what it lists cannot be read, so no store of the tree is judged.",
        "Write each entry of `LISTED` in the file as `['<context>', <Store>],`, its store imported by name; `ddd-ts-kit init --force` writes the file again and keeps what its markers hold.",
      ),
      ...told,
    ];
  }

  const missing = readModelStoresOf(classes).filter((store) => !answers.holds(store));

  const unlisted = missing
    .filter((store) => !isBuiltByAnother(classes, missing, store))
    .map((store) =>
      report(
        { file: store.file, line: store.line, subjects: [list.file] },
        `${store.name} is a read model store of ${store.context} that ${list.file} neither lists, nor names in NOT_LISTED, nor leaves out in a comment between its markers: ${NOTHING_CHECKS}`,
        fixOf(config, list, store),
      ),
    );

  return [...unlisted, ...told];
}

/**
 * A store the list cannot build, which a class written to build it extends: that class is
 * reported with the lines that list it, and listing it answers for the store, so one finding says it.
 */
function isBuiltByAnother(
  classes: DeclaredClasses,
  missing: readonly ReadModelStore[],
  store: ReadModelStore,
): boolean {
  return (
    store.obstacle !== undefined &&
    missing.some(
      (other) => other !== store && other.context === store.context && classes.lineage(other.name).includes(store.name),
    )
  );
}

/** What to write: the lines `init` would, for a store the list can build; what stands in the way, for one it cannot. */
function fixOf(config: Config, list: ReadModelList, store: ReadModelStore): string {
  const { context, name, file, obstacle } = store;
  const leftOut = `to leave the store out on purpose, write between the markers of LISTED (\`// ddd-ts-kit:read-model-tables\`) a comment that holds \`${context}: ${name}\` and the reason: \`init --force\` keeps what the markers hold, and a comment written elsewhere in the file leaves nothing out.`;

  if (ownEntry(config.contexts, context) === undefined) {
    return `${config.contextsDir}/${context} is no context ${CONFIG_FILE} declares, and an entry of the list names a declared context: declare ${context} under \`contexts\` there, or move the store into the context it belongs to; this rule then gives the lines to add.`;
  }

  if (obstacle !== undefined) {
    return `The list cannot build ${name} as it is: ${obstacle}. ${builderOf(store)}; or add \`'${context}: ${name}',\` to NOT_LISTED of ${list.file}, and the start says that nothing checks its table (\`ddd-ts-kit init\` writes that line); ${leftOut}`;
  }

  const from = toAlias(aliasRoots(config), file, specifierSuffix(config.importExtension)) ?? file;
  const { imported, entry } = listingOf(list.imports, { context, store: name, file, from });

  const lines =
    imported === undefined
      ? `add \`${entry}\` to LISTED`
      : `add \`${imported}\` to the imports and \`${entry}\` to LISTED`;

  return `In ${list.file}, ${lines} (\`ddd-ts-kit init\` writes ${imported === undefined ? 'it' : 'both'}); ${leftOut}`;
}

/** How a store the list cannot build gets built: by a class written beside it, unless it is that class already. */
function builderOf({ name, base }: ReadModelStore): string {
  const shape = `an exported class that is not generic, whose own constructor is ${BUILDABLE_CONSTRUCTOR}`;

  return name === `Listed${base}`
    ? `${name} is the class written to build ${base}: make it ${shape}, and \`ddd-ts-kit init\` lists it`
    : `Write beside it, in a file of its own, a class that builds it, \`export class Listed${name} extends ${name} { constructor(database: Persistence['database']) { super(..); } }\` (${shape}), which \`ddd-ts-kit init\` lists and which answers for ${name}`;
}
