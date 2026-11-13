import { aliasRoots, specifierSuffix, toAlias } from '../../alias';
import type { Config } from '../../config';
import { declaredClassesOf } from '../../read-models/declared-classes-of';
import { listHolds } from '../../read-models/list-holds';
import { listingOf } from '../../read-models/listing-of';
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
    'Every read model store of a context kept in a table (a class that is not abstract over `DrizzleReadModelStore`, `KnexReadModelStore`, `PrismaReadModelStore` or `TypeOrmReadModelStore`, directly or through classes of the project) is answered for by `<platformDir>/database/read-model-tables.ts`: an entry of `LISTED` under its context names it or a class that extends it, `NOT_LISTED` names it, or a comment holds `<context>: <Store>` with the reason it is left out. An entry of the list names a class that exists, under the context that declares it. A project on one of the four ORM that holds a store and no list is reported once.',
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
  const stores = readModelStoresOf(declaredClassesOf(project.files));
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
  const report = reporter(project, persistenceReadModelListed.id);
  const classes = declaredClassesOf([...new Set([...project.files, source])]);
  const list = readModelListOf(project.config, source);
  const told = toViolations(report, list.file, listFindings(project, list, classes));

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

  const unlisted = readModelStoresOf(classes)
    .filter((store) => !listHolds(list, classes, store))
    .map((store) =>
      report(
        { file: store.file, line: store.line, subjects: [list.file] },
        `${store.name} is a read model store of ${store.context} that ${list.file} neither lists, nor names in NOT_LISTED, nor leaves out in a comment: ${NOTHING_CHECKS}`,
        fixOf(project.config, source, store),
      ),
    );

  return [...unlisted, ...told];
}

/** The exact lines to write: those `init` would, for a store it can build and for one it cannot. */
function fixOf(config: Config, source: SourceFile, store: ReadModelStore): string {
  const { context, name } = store;
  const leftOut = `to leave the store out on purpose, write in the list a comment that holds \`${context}: ${name}\` and the reason.`;

  if (!store.listable) {
    return `Write beside it a class that builds it, with the constructor of a generated store, \`export class Listed${name} extends ${name} { constructor(database: ..) { super(..); } }\`, which \`ddd-ts-kit init\` lists and which answers for ${name}; or add \`'${context}: ${name}',\` to NOT_LISTED of ${source.path}, and the start says that nothing checks its table (\`ddd-ts-kit init\` writes that line); ${leftOut}`;
  }

  const from = toAlias(aliasRoots(config), store.file, specifierSuffix(config.importExtension)) ?? store.file;
  const { imported, entry } = listingOf(source.text, { context, store: name, from });

  return `In ${source.path}, add \`${imported}\` to the imports and \`${entry}\` to LISTED (\`ddd-ts-kit init\` writes both); ${leftOut}`;
}
