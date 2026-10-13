import { Person } from '@/contexts/identity/domain/aggregates/person.aggregate';
import { DisplayName } from '@/contexts/identity/domain/value-objects/display-name.vo';
import { Email } from '@/contexts/identity/domain/value-objects/email.vo';
import type { PersonColumns, PersonRow } from '@/contexts/identity/infrastructure/persistence/person-row.schema';

export const PersonMapper = {
  toDomain(row: PersonRow): Person {
    const loaded = Person.rehydrate(row.id, {
      registeredAt: row.registered_at,
      displayName: DisplayName.create(row.display_name),
      email: Email.create(row.email),
    });

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: Person): PersonColumns {
    const state = saved.toState();

    return {
      id: saved.id,
      registered_at: state.registeredAt,
      display_name: state.displayName.value,
      email: state.email.value,
    };
  },
};
