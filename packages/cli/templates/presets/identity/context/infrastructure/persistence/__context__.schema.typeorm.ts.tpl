// ddd-ts-kit:imports
import { EntitySchema } from 'typeorm';
import { auditColumns, schemaNameOf } from '@ddd-ts-kit/typeorm';
import type { AccountRow } from '{{alias.context}}/infrastructure/persistence/account-row.schema{{alias.ext}}';
import type { DelegationRow } from '{{alias.context}}/infrastructure/persistence/delegation-row.schema{{alias.ext}}';
import type { InvitationRow } from '{{alias.context}}/infrastructure/persistence/invitation-row.schema{{alias.ext}}';
import type { MemberRow } from '{{alias.context}}/infrastructure/persistence/member-row.schema{{alias.ext}}';
import type { OrganisationRow } from '{{alias.context}}/infrastructure/persistence/organisation-row.schema{{alias.ext}}';
// /ddd-ts-kit:imports

/**
 * The tables of {{context.kebab}}: what the provider authenticates stays with it, no password is stored.
{{#if tenancy.any}}
 * They hold no tenant column: the organisations are the tenants, and this context decides who
 * belongs to which ({{preset.adr}}).
{{/if}}
 */
const {{context.constant}}_SCHEMA = schemaNameOf('{{context.kebab}}');

const instant = (name: string, nullable = false) => ({ name, type: 'timestamptz' as const, nullable });

// ddd-ts-kit:tables
/** Keyed by the subject the identity provider gives the person. */
export const accounts = new EntitySchema<AccountRow>({
  name: '{{context.pascal}}Account',
  tableName: 'accounts',
  schema: {{context.constant}}_SCHEMA,
  columns: {
    id: { type: 'text', primary: true },
    email: { type: 'text' },
    displayName: { name: 'display_name', type: 'text' },
    status: { type: 'text' },
    provisionedAt: instant('provisioned_at'),
    deactivatedAt: instant('deactivated_at', true),
    version: { type: 'int' },
    ...auditColumns(),
  },
});

/** Keyed by the slug, which is also the tenant id when the project has tenants. */
export const organisations = new EntitySchema<OrganisationRow>({
  name: '{{context.pascal}}Organisation',
  tableName: 'organisations',
  schema: {{context.constant}}_SCHEMA,
  columns: {
    id: { type: 'text', primary: true },
    name: { type: 'text' },
    openedBy: { name: 'opened_by', type: 'text' },
    openedAt: instant('opened_at'),
    version: { type: 'int' },
    ...auditColumns(),
  },
});

/** One current membership per account and organisation: the partial unique index is the guard. */
export const members = new EntitySchema<MemberRow>({
  name: '{{context.pascal}}Member',
  tableName: 'members',
  schema: {{context.constant}}_SCHEMA,
  columns: {
    id: { type: 'text', primary: true },
    organisationId: { name: 'organisation_id', type: 'text' },
    accountId: { name: 'account_id', type: 'text' },
    role: { type: 'text' },
    joinedAt: instant('joined_at'),
    removedAt: instant('removed_at', true),
    version: { type: 'int' },
    ...auditColumns(),
  },
  indices: [
    { name: 'members_current_idx', columns: ['organisationId', 'accountId'], unique: true, where: '"removed_at" IS NULL' },
    { name: 'members_account_idx', columns: ['accountId'] },
  ],
});

export const invitations = new EntitySchema<InvitationRow>({
  name: '{{context.pascal}}Invitation',
  tableName: 'invitations',
  schema: {{context.constant}}_SCHEMA,
  columns: {
    id: { type: 'text', primary: true },
    organisationId: { name: 'organisation_id', type: 'text' },
    email: { type: 'text' },
    role: { type: 'text' },
    tokenHash: { name: 'token_hash', type: 'text', unique: true },
    invitedBy: { name: 'invited_by', type: 'text' },
    issuedAt: instant('issued_at'),
    expiresAt: instant('expires_at'),
    status: { type: 'text' },
    answeredAt: instant('answered_at', true),
    version: { type: 'int' },
    ...auditColumns(),
  },
  indices: [{ name: 'invitations_organisation_idx', columns: ['organisationId', 'status'] }],
});

export const delegations = new EntitySchema<DelegationRow>({
  name: '{{context.pascal}}Delegation',
  tableName: 'delegations',
  schema: {{context.constant}}_SCHEMA,
  columns: {
    id: { type: 'text', primary: true },
    organisationId: { name: 'organisation_id', type: 'text' },
    delegatorId: { name: 'delegator_id', type: 'text' },
    delegateId: { name: 'delegate_id', type: 'text' },
    /** The rights lent, separated by commas: a right is a word of `MemberRight`, which holds none. */
    rights: { type: 'text' },
    startsAt: instant('starts_at'),
    endsAt: instant('ends_at'),
    endedAt: instant('ended_at', true),
    version: { type: 'int' },
    ...auditColumns(),
  },
  indices: [
    { name: 'delegations_delegate_idx', columns: ['organisationId', 'delegateId'] },
    { name: 'delegations_delegator_idx', columns: ['organisationId', 'delegatorId'] },
  ],
});
// /ddd-ts-kit:tables
