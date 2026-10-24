import { EntitySchema } from 'typeorm';

/** The rows of a context about persons: three personal columns of two types, a file column, the tenant. A personal column that is not a text accepts null: pseudonymised, it reads nothing. */
export interface PersonRow {
  readonly id: string;
  readonly personId: string;
  readonly displayName: string;
  readonly email: string;
  readonly age: number | null;
  readonly avatarKey: string | null;
  readonly tenantId: string;
  readonly registeredAt: Date;
}

export const people = new EntitySchema<PersonRow>({
  name: 'PrivacyPerson',
  tableName: 'people',
  schema: 'privacy',
  columns: {
    id: { type: 'text', primary: true },
    personId: { type: 'text', name: 'person_id' },
    displayName: { type: 'text', name: 'display_name' },
    email: { type: 'text' },
    age: { type: 'int', nullable: true },
    avatarKey: { type: 'text', name: 'avatar_key', nullable: true },
    tenantId: { type: 'text', name: 'tenant_id' },
    registeredAt: { type: 'timestamp with time zone', precision: 3, name: 'registered_at' },
  },
});

/** The same table, its `age` not nullable: what a pseudonymisation cannot write to. */
export const peopleStrict = new EntitySchema<PersonRow>({
  name: 'PrivacyPersonStrict',
  tableName: 'people_strict',
  schema: 'privacy',
  columns: {
    id: { type: 'text', primary: true },
    personId: { type: 'text', name: 'person_id' },
    displayName: { type: 'text', name: 'display_name' },
    email: { type: 'text' },
    age: { type: 'int' },
    avatarKey: { type: 'text', name: 'avatar_key', nullable: true },
    tenantId: { type: 'text', name: 'tenant_id' },
    registeredAt: { type: 'timestamp with time zone', precision: 3, name: 'registered_at' },
  },
});

/** The same columns declared by their constructor (`String`, `Number`), as a hand-written entity may: the type of a column is read as the schema declares it. */
export const peopleByConstructor = new EntitySchema<PersonRow>({
  name: 'PrivacyPersonByConstructor',
  tableName: 'people_by_constructor',
  schema: 'privacy',
  columns: {
    id: { type: String, primary: true },
    personId: { type: String, name: 'person_id' },
    displayName: { type: String, name: 'display_name' },
    email: { type: String },
    age: { type: Number, nullable: true },
    avatarKey: { type: String, name: 'avatar_key', nullable: true },
    tenantId: { type: String, name: 'tenant_id' },
    registeredAt: { type: 'timestamp with time zone', precision: 3, name: 'registered_at' },
  },
});

export function aPersonRow(subject: string, n: number, tenant = 'acme'): PersonRow {
  return {
    id: `${tenant}:${subject}-${String(n)}`,
    personId: subject,
    displayName: `${subject} ${String(n)}`,
    email: `${subject}-${String(n)}@example.org`,
    age: 30 + n,
    avatarKey: `tenants/${tenant}/avatars/${subject}-${String(n)}`,
    tenantId: tenant,
    registeredAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}
