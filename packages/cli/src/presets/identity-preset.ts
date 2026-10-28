import type { Config } from '../config';
import type { KindFlags } from '../generate/kind';
import { integrationEventKind } from '../generate/kinds/integration-event-kind';
import { repositoryKind } from '../generate/kinds/repository-kind';
import { identityRefusal } from './identity-refusal';
import { IDENTITY_TERMS } from './identity-terms';
import type { Preset } from './preset';
import { presetFiles } from './preset-files';

/** The tables of the context and, in the explicit style, its module: the generators start them, the preset lays them out whole. */
const AFTER_STEPS = [
  '__context__.module.ts',
  'infrastructure/persistence/create-__context__-tables.schema.ts',
  'infrastructure/persistence/__context__.schema.ts',
];

const AGGREGATES = ['Account', 'Organisation', 'Member', 'Invitation', 'Delegation'];

/**
 * What the tables keep of people, with `stack.privacy` on: the generator writes the erasure and the
 * export of the context and lists them in the platform, the preset its own declarations. The tables
 * of the context belong to no tenant, the erasure is not confined to one.
 */
const PERSONAL: Readonly<Record<string, Partial<KindFlags>>> = {
  Account: { personal: 'email,display_name' },
  Invitation: { personal: 'email', erasure: 'row', retention: 'expires_at:30d' },
};

/** The facts other contexts learn: each is declared in the published language and goes through the outbox. */
const PUBLISHED = [
  ['Account', 'Deactivated'],
  ['Organisation', 'Opened'],
  ['Member', 'Joined'],
  ['Member', 'RoleChanged'],
  ['Member', 'Removed'],
  ['Delegation', 'Granted'],
  ['Delegation', 'Revoked'],
];

/**
 * Who the people of the application are, the organisations they belong to and in which role:
 * accounts provisioned from the identity provider at the first sign-in (it authenticates, the
 * application authorizes, no password is kept), organisations (the tenants when the project has
 * tenants), members with roles, invitations, and delegations of rights for a period.
 */
export const identityPreset: Preset = {
  name: 'identity',
  classification: 'generic',
  classificationReason:
    'Every application that serves people who sign in and work in groups needs it, and nothing in it distinguishes this business: it is designed once and kept small.',
  purpose:
    'Who the people of the application are, the organisations they belong to and in which role. The identity provider authenticates them; this context keeps their accounts, invites them, and decides what each member may do in an organisation.',
  terms: IDENTITY_TERMS,
  refusal: identityRefusal,
  steps: [
    ...AGGREGATES.map((aggregate) => ({
      kind: repositoryKind,
      args: [aggregate],
      flags: (config: Config) => (config.stack.privacy === 'on' ? (PERSONAL[aggregate] ?? {}) : {}),
    })),
    ...PUBLISHED.map((fact) => ({ kind: integrationEventKind, args: fact })),
  ],
  grantsEverySignedInPerson: true,
  organisationsAreTenants: true,
  signature: 'domain/services/role-rights.service.ts',
  files: (config) => presetFiles('identity', config, AFTER_STEPS),
  prismaModels: 'prisma/models.prisma.tpl',
  explicitPolicies: 'explicit/access-policies.wiring.tpl',
  e2eFakes: 'e2e/support.wiring.tpl',
};
