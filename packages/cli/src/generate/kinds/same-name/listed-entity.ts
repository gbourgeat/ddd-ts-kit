import { scan } from '../../../check/scan/scan';
import { escapeRegExp } from '../../../check/text/escape-reg-exp';
import { namedBindingsOf } from '../../../migration';
import type { Name } from '../../../naming';
import { freeName } from './free-name';

/** How the schema index of a TypeORM project names an entity: what its import writes, and the name its list reads. */
export interface ListedEntity {
  readonly imported: string;
  readonly local: string;
}

/** An entity to list: its context, its constant, and the constants the tables files of the project export. */
interface EntityToList {
  readonly context: Name;
  readonly constant: string;
  readonly reserved: readonly string[];
  /** Whether a module the index imports from is a file of the context. */
  readonly isOfItsContext: (source: string) => boolean;
}

/**
 * An entity joins the schema index under its own name, and under the name the index already gives
 * it when it imports it from its context. A name the index holds already is the entity of the same
 * name of another context, or a table the index declares itself: two imports of one name would not
 * compile, and one entry would list one table for the two. The second is imported under an alias
 * that carries its context, `import { orders as shippingOrders }`, and listed under it; an alias
 * the index holds, or that a tables file exports and may bring to it, is left to its owner.
 */
export function listedEntity(index: string, entity: EntityToList): ListedEntity {
  const { context, constant, reserved, isOfItsContext } = entity;
  const { code } = scan(index);
  const isNamed = (name: string): boolean => new RegExp(`\\b${escapeRegExp(name)}\\b`).test(code);

  const own = namedBindingsOf(index, 'import')
    .filter(({ source }) => isOfItsContext(source))
    .flatMap(({ names }) => names)
    .find(({ name }) => name === constant);

  const free = (): string => freeName(context, constant, (name) => isNamed(name) || reserved.includes(name));
  const local = own?.local ?? (isNamed(constant) ? free() : constant);

  return { imported: local === constant ? constant : `${constant} as ${local}`, local };
}
