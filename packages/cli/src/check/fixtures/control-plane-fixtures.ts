import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { Fixture } from './fixture';
import { project } from './project';
import { TENANCY_ADAPTERS } from './tenancy-adapters';
import { tenancyBypass } from './tenancy-bypass';

type Orm = keyof typeof TENANCY_ADAPTERS;

const ORMS: readonly Orm[] = ['knex', 'drizzle', 'prisma', 'typeorm'];

/** The body of a statement each ORM confines to no tenant. */
const UNCONFINED: Readonly<Record<Orm, string>> = {
  knex: "return this.database.executor().from('members');",
  drizzle: 'return this.database.executor().select().from(members);',
  prisma: 'return this.database.client().member.findUnique({ where: { id } });',
  typeorm: 'return this.database.manager().findOneBy(members, { id });',
};

/** On each ORM, the statement reported in a context that holds tenant data, and left alone in the control plane of the tenants. */
export function controlPlaneFixtures(): Fixture[] {
  return ORMS.flatMap((orm) => [
    tenancyBypass(orm, 'a statement confined to no tenant, in a context that holds tenant data', UNCONFINED[orm]),
    controlPlaneStatement(orm),
  ]);
}

/**
 * The same statement in a context declared the control plane of the tenants, which decides who
 * belongs to which and whose tables belong to none: not judged, and no suppression asked.
 */
function controlPlaneStatement(orm: Orm): Fixture {
  const { file: adapter, owner } = TENANCY_ADAPTERS[orm];

  const written = config({
    stack: { orm, tenancy: 'shared-table' },
    contexts: {
      billing: { classification: 'core', upstreams: ['catalog'], tenancy: 'control-plane' },
      catalog: { classification: 'supporting', upstreams: [] },
    },
  });

  return {
    ruleId: 'tenancy/scoped-statement',
    name: `${orm}: a statement confined to no tenant, in the control plane of the tenants`,
    expect: 'pass',
    files: project(
      { [adapter]: `export class ${owner} {\n  find() {\n    ${UNCONFINED[orm]}\n  }\n}\n` },
      { [CONFIG_FILE]: written },
    ),
  };
}
