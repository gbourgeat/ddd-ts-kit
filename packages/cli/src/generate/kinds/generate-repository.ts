import type { OrmStack } from '../../config/index.js';
import type { Name } from '../../naming/index.js';
import type { RenderContext } from '../../templating/index.js';
import { emit } from '../emit.js';
import { named } from '../named.js';
import type { Scope } from '../scope.js';
import { vars } from '../vars.js';
import { wire } from '../wire.js';
import { declareStorage } from './declare-storage.js';
import { REPOSITORY_ADAPTERS } from './repository-adapter.js';

/** The port of the repository of an aggregate, the adapter of the ORM of the stack, the fake and the contract both pass. */
export function generateRepository(scope: Scope, aggregate: Name): void {
  const adapter = REPOSITORY_ADAPTERS[scope.config.stack.orm];

  const prefix = {
    pascal: adapter.prefix,
    kebab: adapter.prefix.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
    needsDatabase: adapter.prefix !== 'InMemory',
  };

  const context = vars(scope, { aggregate: named(aggregate), adapter: prefix, tenant: tenantVars(scope) });

  emit(scope, context, [
    ['repository/repository.ts.tpl', `domain/repositories/${aggregate.kebab}.repository.ts`],
    ...adapter.files(aggregate),
    ['repository/fake.ts.tpl', `test/fakes/${aggregate.kebab}.repository.fake.ts`],
    ['repository/contract.spec.ts.tpl', `test/integration/${aggregate.kebab}.repository.contract.spec.ts`],
  ]);

  declareStorage(scope, context);
  wire(scope, 'repository', context);

  scope.ws.note(
    `Fake${aggregate.pascal}Repository (test/fakes) and ${adapter.prefix}${aggregate.pascal}Repository pass the same repositoryContract (test/integration): handlers are tested with the fake.`,
  );
}

const TENANT_AWARE: readonly OrmStack[] = ['drizzle', 'knex'];

/**
 * `--tenant-scoped`: the adapter takes the tenant of the work in progress from the execution scope
 * (`tenantScopeOf`) and confines every statement to it. Defence in depth: the permission is still
 * decided in the application layer.
 */
function tenantVars(scope: Scope): RenderContext {
  const asked = scope.flags.tenantScoped;
  const scoped = asked && TENANT_AWARE.includes(scope.config.stack.orm);

  if (asked && !scoped) {
    scope.ws.note(
      `--tenant-scoped is generated for drizzle and knex only: with ${scope.config.stack.orm}, add the tenant column to the storage (\`tenant_id\`), write \`tenantScopeOf(this.scope)\` on insert and put it in the condition of every read and every update.`,
    );
  }

  return { scoped };
}
