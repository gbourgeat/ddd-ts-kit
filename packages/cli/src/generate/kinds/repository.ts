import type { OrmStack } from '../../config.js';
import type { Name } from '../../naming.js';
import type { RenderContext } from '../../render.js';
import { renderTemplate } from '../../templates.js';
import { applyWiring, emit, wire, type Output } from '../emit.js';
import type { Kind } from '../kind.js';
import { named, openScope, vars, type Scope } from '../scope.js';
import { existingAggregate } from './domain.js';

export const repositoryKind: Kind = {
  name: 'repository',
  aliases: [],
  usage: 'repository <context> <Aggregate>',
  summary: "A repository interface, its in-memory fake, the adapter of the project's ORM with its mapper, the contract suite both pass, and its registration.",
  positionals: ['context', 'Aggregate'],
  run: (request) => {
    const scope = openScope(request);
    generateRepository(scope, existingAggregate(scope, request.args[1] ?? ''));
  },
};

/** The adapter each ORM of the stack gets: its class prefix and the files written next to the interface. */
const ADAPTERS: Readonly<Record<OrmStack, { readonly prefix: string; readonly files: (aggregate: Name, context: Name) => Output[] }>> = {
  none: { prefix: 'InMemory', files: inMemoryAdapter },
  custom: { prefix: 'InMemory', files: inMemoryAdapter },
  drizzle: {
    prefix: 'Drizzle',
    files: (aggregate) => [
      ['repository/drizzle/mapper.ts.tpl', `infrastructure/persistence/${aggregate.kebab}.mapper.ts`],
      ['repository/drizzle/repository.ts.tpl', `infrastructure/persistence/drizzle-${aggregate.kebab}.repository.ts`],
    ],
  },
  knex: {
    prefix: 'Knex',
    files: (aggregate) => [
      ['repository/knex/mapper.ts.tpl', `infrastructure/persistence/${aggregate.kebab}.mapper.ts`],
      ['repository/knex/repository.ts.tpl', `infrastructure/persistence/knex-${aggregate.kebab}.repository.ts`],
    ],
  },
  prisma: {
    prefix: 'Prisma',
    files: (aggregate) => [
      ['repository/prisma/mapper.ts.tpl', `infrastructure/persistence/${aggregate.kebab}.mapper.ts`],
      ['repository/prisma/repository.ts.tpl', `infrastructure/persistence/prisma-${aggregate.kebab}.repository.ts`],
    ],
  },
  typeorm: {
    prefix: 'TypeOrm',
    files: (aggregate) => [
      ['repository/typeorm/mapper.ts.tpl', `infrastructure/persistence/${aggregate.kebab}.mapper.ts`],
      ['repository/typeorm/repository.ts.tpl', `infrastructure/persistence/type-orm-${aggregate.kebab}.repository.ts`],
    ],
  },
};

function inMemoryAdapter(aggregate: Name): Output[] {
  return [['repository/none/repository.ts.tpl', `infrastructure/persistence/in-memory-${aggregate.kebab}.repository.ts`]];
}

export function generateRepository(scope: Scope, aggregate: Name): void {
  const { orm } = scope.config.stack;
  const adapter = ADAPTERS[orm];
  const prefix = { pascal: adapter.prefix, kebab: adapter.prefix.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(), needsDatabase: adapter.prefix !== 'InMemory' };
  const context = vars(scope, { aggregate: named(aggregate), adapter: prefix });
  emit(scope, context, [
    ['repository/repository.ts.tpl', `domain/repositories/${aggregate.kebab}.repository.ts`],
    ...adapter.files(aggregate, scope.context),
    ['repository/fake.ts.tpl', `test/fakes/${aggregate.kebab}.repository.fake.ts`],
    ['repository/contract.spec.ts.tpl', `test/integration/${aggregate.kebab}.repository.contract.spec.ts`],
  ]);
  declareStorage(scope, context);
  wire(scope, 'repository', context);
  scope.ws.note(
    `Fake${aggregate.pascal}Repository (test/fakes) and ${adapter.prefix}${aggregate.pascal}Repository pass the same repositoryContract (test/integration): handlers are tested with the fake.`,
  );
}

/** The table or model of the aggregate, declared where the migration tooling of the ORM reads it. */
function declareStorage(scope: Scope, context: RenderContext): void {
  const { orm } = scope.config.stack;
  if (orm !== 'drizzle' && orm !== 'knex' && orm !== 'typeorm' && orm !== 'prisma') return;
  if (orm === 'prisma') {
    declarePrismaModel(scope, context);
    return;
  }
  const schema = `${scope.dir}/infrastructure/persistence/${scope.context.kebab}.schema.ts`;
  scope.ws.create(schema, renderTemplate(`repository/${orm}/schema.ts.tpl`, context));
  applyWiring(scope.ws, schema, renderTemplate(`repository/${orm}/table.tpl`, context));
  applyWiring(scope.ws, `${scope.config.platformDir}/database/schema.ts`, renderTemplate(`repository/${orm}/schema-export.tpl`, context));
}

const PRISMA_SCHEMA = 'prisma/schema.prisma';

/** Prisma has one schema file for the whole project: the model joins it, and its database schema the datasource. */
function declarePrismaModel(scope: Scope, context: RenderContext): void {
  applyWiring(scope.ws, PRISMA_SCHEMA, renderTemplate('repository/prisma/model.tpl', context));
  const schema = scope.context.kebab.replaceAll('-', '_');
  const content = scope.ws.read(PRISMA_SCHEMA);
  if (content === undefined || new RegExp(`schemas\\s*=\\s*\\[[^\\]]*"${schema}"`).test(content)) return;
  scope.ws.update(PRISMA_SCHEMA, content.replace(/(schemas\s*=\s*\[[^\]]*)\]/, `$1, "${schema}"]`));
  scope.ws.note('prisma/schema.prisma changed: run `npm run db:client` to regenerate the client and the schema of the tests.');
}
