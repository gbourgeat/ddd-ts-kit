/** The schema of the audit entries a migration creates, `undefined` when it creates none. */
export function auditSchemaCreated(migration: string): string | undefined {
  const created = /create table (?:if not exists )?(?:"(\w+)"\.)?"audit_entries"/i.exec(migration);

  if (created === null) {
    return undefined;
  }

  return created[1] ?? 'public';
}
