import { contextAlias, specifierSuffix } from '../../alias';
import { CliError } from '../../cli-error';
import type { Name } from '../../naming';
import type { RenderContext } from '../../templating';
import { emit } from '../emit';
import type { Kind } from '../kind';
import { label } from '../label';
import { learnTerms } from '../learn-terms';
import { named } from '../named';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { vars } from '../vars';
import { wire } from '../wire';
import { wiringFamily } from '../wiring-family';
import { declareTable } from './declare-table';
import { noteTheMigration } from './note-the-migration';
import { fieldLines } from './read-model/field-lines';
import { listReadModel } from './read-model/list-read-model';
import { readModelFields } from './read-model/read-model-fields';
import { readModelStore, type ReadModelStore } from './read-model/read-model-store';

export const readModelKind: Kind = {
  name: 'read-model',
  aliases: [],
  usage:
    'read-model <context> <Name> [--field <name>:<string|number|boolean|instant|decimal>[:nullable]]... [--tenant-scoped] [--term "<Term>=<meaning>"]...',
  summary:
    "The read model a projection keeps: its port (an abstract class of the application layer over ReadModelStore, with the type of its row and the criteria its readers may ask), its table in the schema of the context with the columns of each --field, the store adapter of the project's ORM (in memory without one) bound to the port, its fake, and the contract suite both pass. The projection that writes it comes from `generate projection <context> <Name> <eventType>`.",
  positionals: ['context', 'Name'],
  writesShared: true,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const name = label(scope, request.args[1] ?? '', { what: 'read model', strip: ['port'] });

    refusePlainPort(scope, name);

    const store = readModelStore(scope, name);
    const context = readModelVars(scope, name, store);

    emit(scope, context, [
      ['read-model/port.ts.tpl', `application/ports/${name.kebab}.port.ts`],
      [`read-model/${store.templates}/store.ts.tpl`, `infrastructure/persistence/${store.file}.ts`],
      ['read-model/fake.ts.tpl', `test/fakes/${name.kebab}.fake.ts`],
      ['read-model/contract.spec.ts.tpl', `test/integration/${name.kebab}.contract.spec.ts`],
    ]);

    declareTable(scope, context, { table: store.table, templates: 'read-model', changedBy: CHANGED_BY_HAND });
    register(scope, context, { name, store });
    listTable(scope, store);
    noteTheMigration(scope);

    if (scope.flags.tenantScoped && !store.needsDatabase) {
      scope.ws.note(
        `--tenant-scoped is written for drizzle, knex, prisma and typeorm: ${store.adapter} keeps one read model in memory for every tenant.`,
      );
    }

    scope.ws.note(
      `Fake${name.pascal} (test/fakes) and ${store.adapter} pass the same readModelContract (test/integration): the projection and the handlers that read ${name.pascal} are tested with the fake, and receive the port in their constructor.`,
    );
  },
};

const CHANGED_BY_HAND =
  'Change the table by hand in <file>, with the row and the criteria of its port and the columns of its store adapter; the generator declares a table once.';

/** A port of that name written by `generate port` is no read model: its adapter and its fake would not compile against it. */
function refusePlainPort(scope: Scope, name: Name): void {
  const file = `${scope.dir}/application/ports/${name.kebab}.port.ts`;
  const port = scope.ws.read(file);

  if (port === undefined || port.includes('ReadModelStore<')) {
    return;
  }

  throw new CliError(
    `${file} already declares the port ${name.pascal}, which is not a read model.`,
    `A read model extends ReadModelStore<Row> of @ddd-ts-kit/kernel. Remove that port and its fake (test/fakes/${name.kebab}.fake.ts) if nothing reads them yet, or name the read model otherwise, then run the command again.`,
  );
}

function readModelVars(scope: Scope, name: Name, store: ReadModelStore): RenderContext {
  const fields = readModelFields(scope.flags.field);

  return vars(scope, {
    name: named(name),
    adapter: { pascal: store.adapter, kebab: store.file, needsDatabase: store.needsDatabase },
    table: store.table,
    tenant: { scoped: store.tenantScoped },
    fields: fieldLines(fields, {
      name: store.table,
      constant: name.camel,
      schema: scope.context.kebab.replaceAll('-', '_'),
      tenantScoped: store.tenantScoped,
    }),
  });
}

/**
 * A read model kept in a table joins the list the application checks when it starts
 * (`<platformDir>/database/read-model-tables.ts`): its store is built there as the application
 * binds it, so its table is read by the code the store itself runs before its first trace.
 */
function listTable(scope: Scope, store: ReadModelStore): void {
  const { config, context } = scope;
  const persistence = `${contextAlias(config, context.kebab)}/infrastructure/persistence`;

  if (store.needsDatabase) {
    listReadModel(scope.ws, `${config.platformDir}/database/read-model-tables.ts`, {
      context: context.kebab,
      store: store.adapter,
      from: `${persistence}/${store.file}${specifierSuffix(config.importExtension)}`,
    });
  }
}

interface Registered {
  readonly name: Name;
  readonly store: ReadModelStore;
}

/**
 * Declared, the class binds itself with `@Repository`; in a module file of the container the generator
 * binds it; on a platform wired by hand a note says where it is built, since a constant nothing reads yet
 * would not compile.
 */
function register(scope: Scope, context: RenderContext, { name, store }: Registered): void {
  if (wiringFamily(scope.config) !== 'manual') {
    wire(scope, 'read-model', context);

    return;
  }

  const scopeOfWork = store.tenantScoped ? ', platform.scope' : '';
  const built = store.needsDatabase ? `platform.persistence.database${scopeOfWork}` : '';

  scope.ws.note(
    `Build ${store.adapter} in ${scope.context.kebab}.module.ts and give it to the projection that writes it and to the handlers that read it: platform.adapter(new ${store.adapter}(${built}), { kind: 'repository', context: '${scope.context.kebab}', token: '${name.pascal}' }).`,
  );
}
