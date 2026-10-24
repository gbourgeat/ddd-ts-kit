import type { OrmStack } from '../../config';
import type { Name } from '../../naming';
import type { RenderContext } from '../../templating';
import { emit } from '../emit';
import { named } from '../named';
import type { Scope } from '../scope';
import { vars } from '../vars';
import { wire } from '../wire';
import { declareStorage } from './declare-storage';
import { personalVars } from './personal-data/personal-vars';
import { REPOSITORY_ADAPTERS } from './repository-adapter';
import { repositoryPrefix } from './repository-prefix';

/** The port of the repository of an aggregate, the adapter of the ORM of the stack, the fake and the contract both pass. */
export function generateRepository(scope: Scope, aggregate: Name): RenderContext {
  const adapter = REPOSITORY_ADAPTERS[scope.config.stack.orm];

  const context = vars(scope, {
    aggregate: named(aggregate),
    adapter: repositoryPrefix(scope.config.stack.orm),
    tenant: tenantVars(scope),
    personal: personalVars(scope),
  });

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

  return context;
}

const TENANT_AWARE: readonly OrmStack[] = ['drizzle', 'knex', 'prisma', 'typeorm'];

/**
 * `--tenant-scoped`, or a project whose `stack.tenancy` is not `none`: the adapter confines every
 * statement to the tenant of the work in progress through the helpers of its ORM package
 * (`tenantTable`, `tenantCondition`, `tenantWhere`). Defence in depth: the permission is still
 * decided in the application layer.
 */
function tenantVars(scope: Scope): RenderContext {
  const asked = scope.flags.tenantFree !== true && (scope.flags.tenantScoped || scope.config.stack.tenancy !== 'none');
  const scoped = asked && TENANT_AWARE.includes(scope.config.stack.orm);

  if (asked && !scoped) {
    scope.ws.note(
      `--tenant-scoped is generated for drizzle, knex, prisma and typeorm only: with ${scope.config.stack.orm}, add the tenant column to the storage (\`tenant_id\`), write \`tenantScopeOf(this.scope)\` on insert and put it in the condition of every read and every update.`,
    );
  }

  return { scoped };
}
