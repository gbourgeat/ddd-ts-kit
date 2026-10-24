import { AUDIT_ARCHIVES_TABLE } from './audit-archives-table-name';
import type { AuditTablesOptions } from './audit-tables-options';
import { named } from './named';

/** The functions the triggers run, created or replaced: what a trail installed before the archives runs again to let archived entries go. */
export function auditGuardFunctionsSql(options: AuditTablesOptions = {}): string[] {
  const archives = named(options.schema, AUDIT_ARCHIVES_TABLE);
  const archivesGuard = named(options.schema, 'audit_archives_append_only');
  const guard = named(options.schema, 'audit_entries_append_only');

  return [
    `create or replace function ${guard}() returns trigger language plpgsql as $guard$ begin if tg_op = 'DELETE' then if exists (select 1 from ${archives} a where a."chain" = old."chain" and old."sequence" <= a."to_sequence") then return old; end if; end if; raise exception 'audit entries are append-only: % refused', tg_op using errcode = 'restrict_violation'; end $guard$`,
    `create or replace function ${archivesGuard}() returns trigger language plpgsql as $guard$ begin raise exception 'audit archives are append-only: % refused', tg_op using errcode = 'restrict_violation'; end $guard$`,
  ];
}
