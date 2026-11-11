import { isControlPlane } from '../../../config';
import type { Name } from '../../../naming';
import { WITH_DATABASE } from '../../../stack/with-database';
import type { Scope } from '../../scope';

/** The store adapter of a read model, as the ORM of the stack writes it. */
export interface ReadModelStore {
  /** The class of the adapter: `DrizzleAppointmentList`. */
  readonly adapter: string;
  /** Its file under `infrastructure/persistence`, without the extension. */
  readonly file: string;
  /** The folder of its templates: the ORM, or `none` for the store in memory. */
  readonly templates: string;
  /** The table, named as the read model is, in snake_case. */
  readonly table: string;
  readonly needsDatabase: boolean;
  /** The rows are written in, and every read confined to, the tenant of the work in progress. */
  readonly tenantScoped: boolean;
}

/** The prefix of the class of the store on each ORM that reaches a database; `InMemory` on any other. */
const PREFIXES: Readonly<Record<string, readonly [pascal: string, kebab: string]>> = {
  drizzle: ['Drizzle', 'drizzle'],
  knex: ['Knex', 'knex'],
  prisma: ['Prisma', 'prisma'],
  typeorm: ['TypeOrm', 'type-orm'],
};

const IN_MEMORY = ['InMemory', 'in-memory'] as const;

/**
 * The store adapter `generate read-model` writes for a read model. It is a role file of the
 * persistence, `<orm>-<name>.repository.ts`, declared with `@Repository(<Port>)`: the suffix
 * `naming/suffix` asks of a class bound to a port under `infrastructure/persistence/`, and the
 * decorator `declarations/role-declared` asks of that suffix.
 */
export function readModelStore(scope: Scope, name: Name): ReadModelStore {
  const { orm } = scope.config.stack;
  const needsDatabase = WITH_DATABASE.includes(orm);
  const [pascal, kebab] = PREFIXES[orm] ?? IN_MEMORY;

  return {
    adapter: `${pascal}${name.pascal}`,
    file: `${kebab}-${name.kebab}.repository`,
    templates: needsDatabase ? orm : 'none',
    table: name.kebab.replaceAll('-', '_'),
    needsDatabase,
    tenantScoped: needsDatabase && isTenantData(scope),
  };
}

/**
 * `--tenant-scoped`, or a project whose `stack.tenancy` is not `none` in a context that is not the
 * control plane of the tenants: the store is given the scope of the work, and keeps the tenant of
 * each row itself. The store in memory of a project without an ORM keeps one read model for all.
 */
function isTenantData(scope: Scope): boolean {
  const { config, context, flags } = scope;

  return flags.tenantScoped || (config.stack.tenancy !== 'none' && !isControlPlane(config, context.kebab));
}
