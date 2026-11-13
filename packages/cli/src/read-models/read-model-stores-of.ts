import type { DeclaredClass } from './declared-class';
import type { ReadModelStore } from './read-model-store';

/** The store of a read model kept in a table, of one of the four ORM packages. */
const KIT_STORE = /^(?:Drizzle|Knex|Prisma|TypeOrm)ReadModelStore$/;

/** The constructor a generated store has: the storage, and the scope of the work when it keeps tenant data. */
const BUILT_ON_THE_STORAGE = /\bconstructor\(\s*\w+: [\w.]+(?:,\s*\w+: ExecutionScope)?,?\s*\)/;

const GENERIC = /^class\s+[\w$]+\s*</;

/**
 * The read model stores the contexts hold, read from the text: a class of a context that is not
 * abstract and extends the store of the kit of one of the four ORM, named as the kit names it,
 * directly or through classes of the project, however far and wherever they are declared. When
 * several classes of the project share the name of a base, each of them has to lead to the store
 * of the kit. An abstract class is no store to build. A store in memory or in a search engine has
 * no table: `InMemoryReadModelStore`, `OpenSearchReadModelStore` and the `TableReadModelStore` of
 * the kernel, whose table may be anything, make no store here.
 */
export function readModelStoresOf(classes: readonly DeclaredClass[]): ReadModelStore[] {
  return classes.flatMap((declared) => {
    const { context, file, shape, code } = declared;

    if (context === undefined || shape.isAbstract || !isOverTheKit(declared, classes)) {
      return [];
    }

    const listable = shape.isExported && !GENERIC.test(code) && BUILT_ON_THE_STORAGE.test(code);

    return [{ context, file, name: shape.name, line: shape.line, listable }];
  });
}

function isOverTheKit(
  { shape }: DeclaredClass,
  classes: readonly DeclaredClass[],
  seen: readonly string[] = [],
): boolean {
  const base = shape.superclass;

  if (base === undefined || seen.includes(base)) {
    return false;
  }

  if (KIT_STORE.test(base)) {
    return true;
  }

  const bases = classes.filter((candidate) => candidate.shape.name === base);

  return bases.length > 0 && bases.every((next) => isOverTheKit(next, classes, [...seen, base]));
}
