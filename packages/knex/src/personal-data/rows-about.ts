import type { Knex } from 'knex';
import { tenantScopeOf, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { tableIn } from '../tenancy/table-in';
import { TENANT_COLUMN } from '../tenancy/where-tenant';
import type { KnexContext } from '../unit-of-work/knex-context';
import type { KnexPersonalFields } from './knex-personal-fields';

/** The rows sought: the ones of one subject in one declared table. */
export interface About {
  readonly declaration: KnexPersonalFields;
  readonly subject: string;
}

/**
 * The rows about the subject, in the tenant of the work when the table holds tenant data. A
 * function and not a method: a query builder is thenable, and a method that answers one is read
 * as asynchronous by what wraps the adapter once it is bound (tracing, the aspects), which then
 * answers a promise in its place.
 */
export function rowsAbout(
  context: KnexContext,
  { declaration, subject }: About,
  tenant: ExecutionScope | undefined,
): Knex.QueryBuilder {
  const rows = tableIn(context, declaration.table).where(declaration.subject, subject);

  return tenant === undefined
    ? rows
    : rows.where(declaration.table.column ?? TENANT_COLUMN, tenantScopeOf(tenant).tenantId);
}
