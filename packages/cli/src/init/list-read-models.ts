import { contextAlias, specifierSuffix } from '../alias';
import type { Config } from '../config';
import { applyWiring } from '../generate/apply-wiring';
import { filesUnder } from '../generate/files-under';
import { listReadModel } from '../generate/kinds/read-model/list-read-model';
import type { Workspace } from '../workspace';

/** Every class a file declares over another, with what follows its name: type parameters make it generic. */
const CLASS = /^(?:export )?(abstract )?class (\w+)(<[^{]*?>)?\s+extends\s+(\w+)/gm;

/** The store of a read model kept in a table, of one of the four ORM packages or of the kernel. */
const KIT_STORE = /^(?:Drizzle|Knex|Prisma|TypeOrm|Table)ReadModelStore$/;

/** The constructor a generated store has: the storage, and the scope of the work when it keeps tenant data. */
const BUILT_ON_THE_STORAGE = /\bconstructor\(\s*\w+: [\w.]+(?:,\s*\w+: ExecutionScope)?,?\s*\)/;

const PERSISTENCE = 'infrastructure/persistence/';

/** A class of the persistence of a context, as its file declares it. */
interface Declared {
  readonly context: string;
  /** Its file, from the directory of its context. */
  readonly file: string;
  readonly name: string;
  readonly base: string;
  readonly abstract: boolean;
  readonly generic: boolean;
  /** Its own text, up to the next class of the file. */
  readonly body: string;
}

/**
 * The read model stores the tree holds join the list the application checks when it starts
 * (`<platformDir>/database/read-model-tables.ts`): a project generated before the list existed,
 * or whose list was emptied, would otherwise start and pass `db:read-models` with nothing
 * checked. Every class of the persistence of a context is read, several in one file included, and
 * a store is a class over the store of the kit, directly or through a base class of the project.
 * One whose own constructor is the generated one is listed under its context, under an alias when
 * another context holds a class of that name. Any other (a constructor that takes something else
 * or is inherited, a generic class) is named in `NOT_LISTED`, which the check tells at each
 * start, with a note that says what to write. An abstract class is no store to build. What the
 * file already names, `<context>: <Store>` in a comment included, is left as it is: that is how a
 * store left out on purpose stays out.
 */
export function listReadModels(ws: Workspace, config: Config): void {
  const list = `${config.platformDir}/database/read-model-tables.ts`;

  const declared = ws.exists(list)
    ? Object.keys(config.contexts).flatMap((context) => classesOf(ws, config, context))
    : [];

  const bases = new Map(declared.map((entry) => [entry.name, entry.base]));

  for (const store of declared.filter((entry) => !entry.abstract && isStore(entry.base, bases))) {
    if ((ws.read(list) ?? '').includes(`${store.context}: ${store.name}`)) {
      continue;
    }

    if (!store.generic && BUILT_ON_THE_STORAGE.test(store.body)) {
      listReadModel(ws, list, { context: store.context, store: store.name, from: importOf(config, store) });
    } else {
      leaveOut(ws, config, store);
    }
  }
}

function classesOf(ws: Workspace, config: Config, context: string): Declared[] {
  const directory = `${config.contextsDir}/${context}`;
  const files = filesUnder(ws, directory).filter((held) => held.includes(PERSISTENCE) && held.endsWith('.ts'));

  return files.flatMap((file) => {
    const source = ws.read(`${directory}/${file}`) ?? '';
    const found = [...source.matchAll(CLASS)];

    return found.map(([, abstract, name = '', generic, base = ''], position) => ({
      context,
      file,
      name,
      base,
      abstract: abstract !== undefined,
      generic: generic !== undefined,
      body: source.slice(found[position]?.index, found[position + 1]?.index),
    }));
  });
}

/** Whether a base class is the store of the kit, or a class of the project that extends it, however far. */
function isStore(base: string, bases: ReadonlyMap<string, string>, seen: readonly string[] = []): boolean {
  const next = bases.get(base);

  return KIT_STORE.test(base) || (next !== undefined && !seen.includes(base) && isStore(next, bases, [...seen, base]));
}

function importOf(config: Config, { context, file }: Declared): string {
  return `${contextAlias(config, context)}/${file.slice(0, -'.ts'.length)}${specifierSuffix(config.importExtension)}`;
}

/** A store the list cannot build with certainty is named among those not listed, once, with what to write. */
function leaveOut(ws: Workspace, config: Config, { context, file, name }: Declared): void {
  const list = `${config.platformDir}/database/read-model-tables.ts`;

  applyWiring(ws, list, `@@read-models-not-listed\n'${context}: ${name}',\n`);

  ws.note(
    `${name} (${config.contextsDir}/${context}/${file}) is a read model store this command cannot list with certainty: its own constructor is not \`(database)\` nor \`(database, scope)\`, or the class is generic. ${list} names it in NOT_LISTED, and the check of the read model tables says at each start that nothing checks its table. Write there a class that builds it, \`class Listed${name} extends ${name} { constructor(database: Persistence['database']) { super(..); } }\`, add \`['${context}', Listed${name}],\` to LISTED and remove its line from NOT_LISTED; to leave it out on purpose, replace that line by a comment that holds \`${context}: ${name}\` and the reason.`,
  );
}
