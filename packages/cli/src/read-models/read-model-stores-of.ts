import type { DeclaredClass } from './declared-class';
import type { DeclaredClasses } from './declared-classes';
import type { ReadModelStore } from './read-model-store';

/** The store of a read model kept in a table, of one of the four ORM packages. */
const KIT_STORE = /^(?:Drizzle|Knex|Prisma|TypeOrm)ReadModelStore$/;

const MODIFIERS = '(?:(?:public|private|protected|readonly)\\s+)*';

/** The type of the storage: a name, dotted or not, or a member of one, `Persistence['database']`. */
const STORAGE = '[\\w$.]+(?:\\[[\'"`][^\\]]*[\'"`]\\])*';

/** The constructor a generated store has: the storage, and the scope of the work when it keeps tenant data. */
const BUILT_ON_THE_STORAGE = new RegExp(
  `\\bconstructor\\(\\s*${MODIFIERS}[\\w$]+: ${STORAGE}(?:,\\s*${MODIFIERS}[\\w$]+: ExecutionScope)?,?\\s*\\)`,
);

const GENERIC = /^class\s+[\w$]+\s*</;

/** The classes, and what was already found of each: whether it leads to the store of the kit. */
interface Walk {
  readonly classes: DeclaredClasses;
  readonly verdicts: Map<DeclaredClass, boolean>;
}

/**
 * The read model stores the contexts hold, read from the text: a class of a context that is not
 * abstract and extends the store of the kit of one of the four ORM, named as the kit names it,
 * directly or through classes of the project, however far and wherever they are declared. When
 * several classes of the project share the name of a base, each of them has to lead to the store
 * of the kit. An abstract class is no store to build. A store in memory or in a search engine has
 * no table: `InMemoryReadModelStore`, `OpenSearchReadModelStore` and the `TableReadModelStore` of
 * the kernel, whose table may be anything, make no store here. A base that is not a name of the
 * kit or of a class of the project (a namespace, an import alias, a call) leads nowhere.
 */
export function readModelStoresOf(classes: DeclaredClasses): ReadModelStore[] {
  const walk: Walk = { classes, verdicts: new Map() };

  return classes.all.flatMap((declared) => {
    const { context, file, shape } = declared;
    const base = shape.superclass;

    if (context === undefined || base === undefined || shape.isAbstract || !isOverTheKit(walk, declared)) {
      return [];
    }

    return [{ context, file, name: shape.name, line: shape.line, base, obstacle: obstacleOf(declared) }];
  });
}

function isOverTheKit(walk: Walk, declared: DeclaredClass, seen: readonly string[] = []): boolean {
  const known = walk.verdicts.get(declared);

  if (known !== undefined) {
    return known;
  }

  const verdict = leadsToTheKit(walk, declared.shape.superclass, seen);

  // A verdict reached while a cycle was being walked is that of the walk, not of the class.
  if (seen.length === 0) {
    walk.verdicts.set(declared, verdict);
  }

  return verdict;
}

function leadsToTheKit(walk: Walk, base: string | undefined, seen: readonly string[]): boolean {
  if (base === undefined || seen.includes(base)) {
    return false;
  }

  const bases = walk.classes.named(base);

  return KIT_STORE.test(base) || (bases.length > 0 && bases.every((next) => isOverTheKit(walk, next, [...seen, base])));
}

function obstacleOf({ shape, code, isDefaultOnly }: DeclaredClass): string | undefined {
  if (isDefaultOnly) {
    return 'it is the default export of its file, and the list imports a store by its name';
  }

  if (!shape.isExported) {
    return 'its file does not export it';
  }

  if (GENERIC.test(code)) {
    return 'the class is generic';
  }

  return BUILT_ON_THE_STORAGE.test(code)
    ? undefined
    : 'its own constructor is not the one of a generated store, or is inherited';
}
