import { unwrap } from '@ddd-ts-kit/kernel';
import { Person } from '@/contexts/identity/domain/aggregates/person.aggregate.js';
import { DisplayName } from '@/contexts/identity/domain/value-objects/display-name.vo.js';
import { Email } from '@/contexts/identity/domain/value-objects/email.vo.js';
import type { PersonColumns, PersonRow } from '@/contexts/identity/infrastructure/persistence/person-row.schema.js';

export const PersonMapper = {
  toDomain(row: PersonRow): Person {
    const loaded = Person.rehydrate(row.id, {
      registeredAt: row.registered_at,
      displayName: unwrap(DisplayName.create(row.display_name)),
      email: unwrap(Email.create(row.email)),
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
