import { contextAlias, specifierSuffix } from '../alias';
import { namedOutsideImports } from '../check/scan/named-outside-imports';
import type { Config } from '../config';
import { applyWiring } from '../generate/apply-wiring';
import { filesUnder } from '../generate/files-under';
import type { Workspace } from '../workspace';

/** A read model store kept in a table: a class over the store of one of the four ORM packages, or over the kernel's. */
const STORE = /^export class (\w+)\s+extends (?:Drizzle|Knex|Prisma|TypeOrm|Table)ReadModelStore</m;

/** The constructor a generated store has: the storage, and the scope of the work when it keeps tenant data. */
const BUILT_ON_THE_STORAGE = /\bconstructor\(\s*\w+: [\w.]+(?:,\s*\w+: ExecutionScope)?,?\s*\)/;

const PERSISTENCE = 'infrastructure/persistence/';

/**
 * The read model stores the tree holds join the list the application checks when it starts
 * (`<platformDir>/database/read-model-tables.ts`): a project generated before the list existed,
 * or whose list was emptied, would otherwise start and pass `db:read-models` with nothing
 * checked. A store whose constructor is the generated one is listed under its context; any other
 * is named among those not listed, which the check tells at each start, with a note that says
 * what to write. What the list names already is left as it is.
 */
export function listReadModels(ws: Workspace, config: Config): void {
  const list = `${config.platformDir}/database/read-model-tables.ts`;

  for (const context of ws.exists(list) ? Object.keys(config.contexts) : []) {
    const directory = `${config.contextsDir}/${context}`;

    for (const file of filesUnder(ws, directory).filter((held) => held.includes(PERSISTENCE) && held.endsWith('.ts'))) {
      const source = ws.read(`${directory}/${file}`) ?? '';
      const [, store] = STORE.exec(source) ?? [];

      if (store !== undefined && !known(ws.read(list) ?? '', store)) {
        applyWiring(ws, list, wiringOf(ws, { config, context, file, store, built: BUILT_ON_THE_STORAGE.test(source) }));
      }
    }
  }
}

function known(list: string, store: string): boolean {
  return namedOutsideImports(list, store) || list.includes(`'${store}',`);
}

interface Found {
  readonly config: Config;
  readonly context: string;
  /** The file of the store, from the directory of its context. */
  readonly file: string;
  readonly store: string;
  /** Whether its constructor is the one the list builds a store with. */
  readonly built: boolean;
}

function wiringOf(ws: Workspace, { config, context, file, store, built }: Found): string {
  const from = `${contextAlias(config, context)}/${file.slice(0, -'.ts'.length)}${specifierSuffix(config.importExtension)}`;

  if (built) {
    return `@@imports\nimport { ${store} } from '${from}';\n@@read-model-tables\n['${context}', ${store}],\n`;
  }

  ws.note(
    `${store} (${config.contextsDir}/${context}/${file}) is a read model store whose constructor is not \`(database)\` nor \`(database, scope)\`: ${config.platformDir}/database/read-model-tables.ts cannot build it, names it in NOT_LISTED, and the check of the read model tables says at each start that nothing checks its table. Write there a class that builds it, \`class Listed${store} extends ${store} { constructor(database: Persistence['database']) { super(..); } }\`, add \`['${context}', Listed${store}],\` to LISTED and remove its name from NOT_LISTED.`,
  );

  return `@@read-models-not-listed\n'${store}',\n`;
}
