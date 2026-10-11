import { unwrap } from '@ddd-ts-kit/kernel';
import { Practice } from '@/contexts/identity/domain/aggregates/practice.aggregate';
import { Membership } from '@/contexts/identity/domain/value-objects/membership.vo';
import { Role } from '@/contexts/identity/domain/value-objects/role.vo';
import { TimeZone } from '@/contexts/identity/domain/value-objects/time-zone.vo';
import type { PracticeColumns, PracticeRow } from '@/contexts/identity/infrastructure/persistence/practice-row.schema';

interface StoredMember {
  readonly personId: string;
  readonly role: string;
}

export const PracticeMapper = {
  toDomain(row: PracticeRow): Practice {
    const loaded = Practice.rehydrate(row.id, {
      registeredAt: row.registered_at,
      name: row.name,
      timeZone: unwrap(TimeZone.create(row.time_zone)),
      members: storedMembersOf(row.members).map((member) =>
        Membership.create(member.personId, unwrap(Role.create(member.role))),
      ),
    });

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: Practice): PracticeColumns {
    const state = saved.toState();

    const members: readonly StoredMember[] = state.members.map((member) => ({
      personId: member.personId,
      role: member.role,
    }));

    return {
      id: saved.id,
      registered_at: state.registeredAt,
      name: state.name,
      time_zone: state.timeZone.value,
      members: JSON.stringify(members),
    };
  },
};

/** The driver hands a JSON column back already parsed; the row type says what was written. */
function storedMembersOf(column: unknown): readonly StoredMember[] {
  const parsed: unknown = typeof column === 'string' ? JSON.parse(column) : column;

  return Array.isArray(parsed) ? parsed.filter(isStoredMember) : [];
}

function isStoredMember(value: unknown): value is StoredMember {
  return (
    typeof value === 'object' &&
    value !== null &&
    'personId' in value &&
    'role' in value &&
    typeof value.personId === 'string' &&
    typeof value.role === 'string'
  );
}
