import assert from 'node:assert/strict';
import { test } from 'node:test';
import { problemsOf } from './parity.mjs';

const CONTRACT = `
export interface ProcessStoreContractOptions {
  readonly name: string;
  createStore(): unknown;
  readonly unitOfWork?: () => unknown;
  readonly storeInTenant?: (scope: unknown) => unknown;
}

export function processStoreContract(runner: ContractRunner, options: ProcessStoreContractOptions): void {}
`;

const KNEX_IN_TENANT = `
export interface KnexProcessStoreOptions {
  readonly schema?: string;
  readonly tenant?: ExecutionScope;
}`;

const PRISMA = `
export interface PrismaProcessStoreOptions<Tx> {
  readonly delegate: (client: Tx) => unknown;
}`;

const PRISMA_IN_TENANT = `
export interface PrismaProcessStoreOptions<Tx> {
  readonly delegate: (client: Tx) => unknown;
  readonly tenant?: ExecutionScope;
}`;

/** A reason long enough to be read as one. */
const REASON = 'the member keeps the instances another way';

const RUN_IN_TENANT = `processStoreContract(runner, { name: 'a', createStore, storeInTenant: (tenant) => store(tenant) });`;
const RUN = `processStoreContract(runner, { name: 'b', createStore: () => store() });`;

test('an option of one member alone fails, and names the members that have it', () => {
  const problems = problemsOf(
    family(),
    source({ knex: KNEX_IN_TENANT, prisma: PRISMA, knexSpec: RUN_IN_TENANT, prismaSpec: RUN_IN_TENANT }),
  );

  assert.deepEqual(problems, [
    'ORM, process store: prisma has no option `tenant`, which knex offers. Add it, or say in families.mjs (apart) why prisma goes without.',
  ]);
});

test('a capability of the contract one member gives and another does not fails', () => {
  const problems = problemsOf(
    family(),
    source({ knex: KNEX_IN_TENANT, prisma: PRISMA_IN_TENANT, knexSpec: RUN_IN_TENANT, prismaSpec: RUN }),
  );

  assert.deepEqual(problems, [
    'ORM, process store: prisma runs processStoreContract without `storeInTenant`, which knex gives it. Give it, or say in families.mjs (capabilitiesApart) why not.',
  ]);
});

test('an asymmetry written with its reason passes, and fails once it is no longer true', () => {
  const apart = {
    apart: { tenant: { prisma: REASON } },
    capabilitiesApart: { storeInTenant: { prisma: REASON } },
  };
  const lacking = source({ knex: KNEX_IN_TENANT, prisma: PRISMA, knexSpec: RUN_IN_TENANT, prismaSpec: RUN });

  assert.deepEqual(problemsOf(family(apart), lacking), []);

  const caughtUp = source({
    knex: KNEX_IN_TENANT,
    prisma: PRISMA_IN_TENANT,
    knexSpec: RUN_IN_TENANT,
    prismaSpec: RUN_IN_TENANT,
  });

  assert.deepEqual(problemsOf(family(apart), caughtUp), [
    'ORM, process store: prisma now offers `tenant`: remove its exception from families.mjs (apart).',
    'ORM, process store: prisma now gives `storeInTenant` to processStoreContract: remove its exception from families.mjs (capabilitiesApart).',
  ]);
});

test('a reason that says too little is refused', () => {
  const vague = {
    apart: { tenant: { prisma: 'later' } },
    capabilitiesApart: { storeInTenant: { prisma: 'TODO: fix this one day' } },
  };
  const lacking = source({ knex: KNEX_IN_TENANT, prisma: PRISMA, knexSpec: RUN_IN_TENANT, prismaSpec: RUN });

  assert.deepEqual(problemsOf(family(vague), lacking), [
    'ORM, process store: the reason given for prisma says too little ("later"): say what the member does instead, or fill the gap.',
    'ORM, process store: the reason given for prisma says too little ("TODO: fix this one day"): say what the member does instead, or fill the gap.',
  ]);
});

test('a member whose specs never run the contract fails, unless it says why', () => {
  const silent = source({ knex: PRISMA.replace('Prisma', 'Knex'), prisma: PRISMA, knexSpec: '', prismaSpec: RUN });

  assert.deepEqual(problemsOf(family(), silent), [
    'ORM, process store: the specs of knex never run processStoreContract. Hold its adapter to it, or say in families.mjs (withoutContract) why not.',
  ]);

  assert.deepEqual(problemsOf(family({ withoutContract: { knex: REASON } }), silent), []);
});

test('a call with a type argument is a call of the contract', () => {
  const generic = RUN_IN_TENANT.replace('processStoreContract(', 'processStoreContract<Invoice>(');

  assert.deepEqual(
    problemsOf(family(), source({ knex: KNEX_IN_TENANT, prisma: PRISMA, knexSpec: generic, prismaSpec: generic }))
      .length,
    1,
  );
});

test('a port proven by some calls of a contract counts those calls alone', () => {
  const shared = `processStoreContract(runner, { name: 'knex, shared tables', createStore });`;
  const underSecurity = `processStoreContract(runner, { name: 'knex, row-level security', createStore });`;
  const port = { calls: /row-level security/ };
  const run = (prismaSpec) =>
    problemsOf(
      family(port),
      source({ knex: PRISMA.replace('Prisma', 'Knex'), prisma: PRISMA, knexSpec: underSecurity, prismaSpec }),
    );

  assert.deepEqual(run(underSecurity.replace('knex', 'prisma')), []);
  assert.deepEqual(run(shared), [
    'ORM, process store: the specs of prisma never run processStoreContract. Hold its adapter to it, or say in families.mjs (withoutContract) why not.',
  ]);
});

test('the options of the place are never compared, and an interface is read through extends, Pick and Omit', () => {
  const knex = `
export interface KnexStore extends Store {}
export interface TableOptions {
  readonly schema?: string;
  readonly table?: string;
  readonly tenant?: boolean;
}
export interface KnexProcessStoreOptions extends Omit<TableOptions, 'tenant'>, Pick<Scoped, 'tenant'> {
  readonly table?: string;
}`;
  const prisma = `
export interface PrismaProcessStoreOptions<Tx> {
  readonly delegate: (client: Tx) => unknown;
  readonly tenant?: ExecutionScope;
}`;

  assert.deepEqual(
    problemsOf(
      family({ place: ['schema', 'table', 'delegate'] }),
      source({ knex, prisma, knexSpec: RUN, prismaSpec: RUN }),
    ),
    [],
  );
});

test('an options interface that is not in the package is reported', () => {
  const problems = problemsOf(family(), source({ knex: '', prisma: PRISMA, knexSpec: RUN, prismaSpec: RUN }));

  assert.equal(problems[0], 'ORM, process store: KnexProcessStoreOptions is not an interface of knex/src.');
});

/** Two ORM whose process stores take the options and run the contract as `knex` and `prisma` say. */
function source({ knex, prisma, knexSpec, prismaSpec }) {
  const sources = { knex: [{ file: 'a.ts', text: knex }], prisma: [{ file: 'b.ts', text: prisma }] };
  const tests = { knex: [{ file: 'a.spec.ts', text: knexSpec }], prisma: [{ file: 'b.spec.ts', text: prismaSpec }] };

  return {
    sources: (member) => sources[member],
    tests: (member) => tests[member],
    contracts: [{ file: 'c.ts', text: CONTRACT }],
  };
}

function family(port = {}) {
  return [
    {
      family: 'ORM',
      members: ['knex', 'prisma'],
      ports: [
        {
          port: 'process store',
          options: { knex: 'KnexProcessStoreOptions', prisma: 'PrismaProcessStoreOptions' },
          place: ['schema', 'delegate'],
          contract: 'processStoreContract',
          ...port,
        },
      ],
    },
  ];
}
