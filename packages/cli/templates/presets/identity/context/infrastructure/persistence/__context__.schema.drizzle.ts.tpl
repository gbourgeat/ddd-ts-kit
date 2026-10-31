// ddd-ts-kit:imports
import { sql } from 'drizzle-orm';
import { index, integer, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { auditColumns, contextSchema } from '@ddd-ts-kit/drizzle/postgres';
import type { AccountStatus } from '{{alias.context}}/domain/vocabularies/account-status.vocabulary{{alias.ext}}';
import type { InvitationStatus } from '{{alias.context}}/domain/vocabularies/invitation-status.vocabulary{{alias.ext}}';
import type { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
// /ddd-ts-kit:imports

/**
 * The tables of {{context.kebab}}: what the provider authenticates stays with it, no password is stored.
{{#if tenancy.any}}
 * They hold no tenant column: the organisations are the tenants, and this context decides who
 * belongs to which ({{preset.adr}}).
{{/if}}
 */
export const {{context.camel}}Schema = contextSchema('{{context.kebab}}');

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

// ddd-ts-kit:tables
/** Keyed by the subject the identity provider gives the person. */
export const accounts = {{context.camel}}Schema.table('accounts', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  status: text('status').$type<AccountStatus>().notNull(),
  provisionedAt: instant('provisioned_at').notNull(),
  deactivatedAt: instant('deactivated_at'),
  version: integer('version').notNull(),
  ...auditColumns(),
});

/** Keyed by the slug, which is also the tenant id when the project has tenants. */
export const organisations = {{context.camel}}Schema.table('organisations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  openedBy: text('opened_by').notNull(),
  openedAt: instant('opened_at').notNull(),
  version: integer('version').notNull(),
  ...auditColumns(),
});

/** One current membership per account and organisation: the partial unique index is the guard. */
export const members = {{context.camel}}Schema.table(
  'members',
  {
    id: text('id').primaryKey(),
    organisationId: text('organisation_id').notNull(),
    accountId: text('account_id').notNull(),
    role: text('role').$type<MemberRole>().notNull(),
    joinedAt: instant('joined_at').notNull(),
    removedAt: instant('removed_at'),
    version: integer('version').notNull(),
    ...auditColumns(),
  },
  (table) => [
    uniqueIndex('members_current_idx').on(table.organisationId, table.accountId).where(sql`removed_at is null`),
    index('members_account_idx').on(table.accountId),
  ],
);

export const invitations = {{context.camel}}Schema.table(
  'invitations',
  {
    id: text('id').primaryKey(),
    organisationId: text('organisation_id').notNull(),
    email: text('email').notNull(),
    role: text('role').$type<MemberRole>().notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: text('invited_by').notNull(),
    delegationId: text('delegation_id'),
    issuedAt: instant('issued_at').notNull(),
    expiresAt: instant('expires_at').notNull(),
    status: text('status').$type<InvitationStatus>().notNull(),
    answeredAt: instant('answered_at'),
    version: integer('version').notNull(),
    ...auditColumns(),
  },
  (table) => [index('invitations_organisation_idx').on(table.organisationId, table.status)],
);

export const delegations = {{context.camel}}Schema.table(
  'delegations',
  {
    id: text('id').primaryKey(),
    organisationId: text('organisation_id').notNull(),
    delegatorId: text('delegator_id').notNull(),
    delegateId: text('delegate_id').notNull(),
    /** The rights lent, separated by commas: a right is a word of `MemberRight`, which holds none. */
    rights: text('rights').notNull(),
    startsAt: instant('starts_at').notNull(),
    endsAt: instant('ends_at').notNull(),
    endedAt: instant('ended_at'),
    version: integer('version').notNull(),
    ...auditColumns(),
  },
  (table) => [
    index('delegations_delegate_idx').on(table.organisationId, table.delegateId),
    index('delegations_delegator_idx').on(table.organisationId, table.delegatorId),
  ],
);
// /ddd-ts-kit:tables
