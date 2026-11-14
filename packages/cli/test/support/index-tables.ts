import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { afterAll } from 'vitest';
import { REPO_ROOT } from '../helpers';

const INDEX = 'src/platform/database/schema.ts';

/** The sources of the project a load may reach: the index, the persistence of the contexts, and what a team makes them import. */
const SOURCE =
  /^src\/(?:platform\/database\/schema|contexts\/[^/]+\/(?:[^/]+\/)?infrastructure\/persistence\/.+|shared-kernel\/.+|legacy(?:\/.+)?)(?<!\.spec)\.m?ts$/;

const STALE = 60 * 60 * 1000;
const copies: string[] = [];

afterAll(() => {
  copies.splice(0).forEach((copy) => fs.rmSync(copy, { recursive: true, force: true }));
});

/** What loading the schema index of a project gave, or why it did not load. */
export interface LoadedIndex {
  /** The tables the index holds, each `<schema>.<table>`. */
  readonly tables: readonly string[];
  /** The table each name of the index is bound to, on Drizzle. */
  readonly bound: Readonly<Record<string, string>>;
  /** The tables a tables file of a context exports that the index holds under no name: the same object, not the same name. */
  readonly missing: readonly string[];
  /** Every name the index exports with a value. */
  readonly exports: readonly string[];
  /** The entities the index lists more than once, on TypeORM. */
  readonly twice: readonly string[];
  readonly error?: string;
}

type Loaded = Readonly<Record<string, unknown>>;

/**
 * Loads the schema index of a generated project for real, as the test database and the migration
 * tooling load it, and answers the tables it holds: the Drizzle tables among its exports, the
 * entities of its `entities` on TypeORM. Nothing of the kit reads the files here: the modules run.
 * The tables file of each context is loaded beside it, and each table it exports is looked for in
 * the index as the object it is. The index and the persistence files of the contexts are copied to
 * a folder of their own, the alias of the project written as a path, so that each load reads the
 * files as they are now. A name the index exports that no module gives a value, a type exported as
 * a value, is what stops a real load: it is an error here too.
 */
export async function loadedIndex(root: string): Promise<LoadedIndex> {
  const copy = copyOf(root);

  try {
    const loaded = await load(path.join(copy, INDEX));
    const held = 'entities' in loaded ? entitiesOf(loaded) : Object.values(loaded).filter(isTable);
    const exported = await tablesOfContexts(copy);
    const empty = Object.keys(loaded).filter((name) => loaded[name] === undefined);

    return {
      tables: [...new Set(held.map(nameOf))].sort(),
      bound: Object.fromEntries(
        Object.entries(loaded).flatMap(([name, value]) => (isDrizzle(value) ? [[name, nameOf(value)]] : [])),
      ),
      exports: Object.keys(loaded).filter((name) => loaded[name] !== undefined),
      missing: exported.filter((table) => !held.includes(table)).map(nameOf),
      twice: 'entities' in loaded ? held.filter((table, at) => held.indexOf(table) !== at).map(nameOf) : [],
      ...(empty.length === 0
        ? {}
        : { error: `the index exports ${empty.join(', ')}, which no module holds as a value` }),
    };
  } catch (error) {
    return { tables: [], bound: {}, exports: [], missing: [], twice: [], error: String(error) };
  }
}

async function load(file: string): Promise<Loaded> {
  const loaded: Loaded = await import(/* @vite-ignore */ pathToFileURL(file).href);

  return loaded;
}

/** Every table the tables files of the contexts export, as the objects they are. */
async function tablesOfContexts(copy: string): Promise<Table[]> {
  const contexts = fs.readdirSync(path.join(copy, 'src/contexts'));

  const files = contexts
    .map((context) => path.join(copy, tablesFileOf(copy, context)))
    .filter((file) => fs.existsSync(file));

  const modules = await Promise.all(files.map(load));

  return modules.flatMap((module) => Object.values(module).filter(isTable));
}

function tablesFileOf(copy: string, context: string): string {
  const flat = `src/contexts/${context}/infrastructure/persistence/${context}.schema.ts`;
  const shared = `src/contexts/${context}/shared/infrastructure/persistence/${context}.schema.ts`;

  return fs.existsSync(path.join(copy, shared)) ? shared : flat;
}

/** A TypeORM entity as its schema declares it. */
interface Entity {
  readonly options: { readonly schema?: string; readonly tableName?: string };
}

type Table = PgTable | Entity;

function isDrizzle(value: unknown): value is PgTable {
  return is(value, PgTable);
}

function isEntity(value: unknown): value is Entity {
  return typeof value === 'object' && value !== null && 'options' in value && !isDrizzle(value);
}

function isTable(value: unknown): value is Table {
  return isDrizzle(value) || isEntity(value);
}

function nameOf(table: Table): string {
  if (isDrizzle(table)) {
    return `${getTableConfig(table).schema ?? ''}.${getTableConfig(table).name}`;
  }

  return `${table.options.schema ?? ''}.${table.options.tableName ?? ''}`;
}

function entitiesOf(loaded: Loaded): Entity[] {
  const entities: unknown = loaded['entities'];

  return Array.isArray(entities) ? entities.filter(isEntity) : [];
}

/** Under the tests of the package, so that the runner reads the copy as it reads the sources: the packages of the kit from their sources, no build needed. */
const COPIES = path.join(REPO_ROOT, 'packages/cli/test/.loaded-index');

function copyOf(root: string): string {
  fs.mkdirSync(COPIES, { recursive: true });
  removeLeftovers();

  const copy = fs.mkdtempSync(path.join(COPIES, 'copy-'));
  const modules = path.join(copy, 'node_modules');

  copies.push(copy);
  fs.mkdirSync(modules);
  fs.symlinkSync(path.join(REPO_ROOT, 'packages/typeorm/node_modules/typeorm'), path.join(modules, 'typeorm'));

  for (const file of sourcesOf(root, 'src').filter((source) => SOURCE.test(source))) {
    const text = fs.readFileSync(path.join(root, file), 'utf8').replaceAll("'@/", `'${copy}/src/`);

    fs.mkdirSync(path.dirname(path.join(copy, file)), { recursive: true });
    fs.writeFileSync(path.join(copy, file), text);
  }

  return copy;
}

function sourcesOf(root: string, directory: string): string[] {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`;

    return entry.isDirectory() ? sourcesOf(root, relative) : [relative];
  });
}

/** The copies a run that was stopped left behind: those of more than an hour, which no run still reads. */
function removeLeftovers(): void {
  for (const entry of fs.readdirSync(COPIES)) {
    const copy = path.join(COPIES, entry);

    if (Date.now() - (fs.statSync(copy, { throwIfNoEntry: false })?.mtimeMs ?? Date.now()) > STALE) {
      fs.rmSync(copy, { recursive: true, force: true });
    }
  }
}
