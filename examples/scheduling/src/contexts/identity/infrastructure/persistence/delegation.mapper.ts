import { Delegation } from '../../domain/aggregates/delegation.aggregate.js';
import { Desk } from '../../domain/value-objects/desk.vo.js';
import type { DelegationColumns, DelegationRow } from './delegation-row.schema.js';

export const DelegationMapper = {
  toDomain(row: DelegationRow): Delegation {
    const loaded = Delegation.rehydrate(row.id, {
      registeredAt: row.registered_at,
      desk: Desk.create(row.practice_id, row.practitioner_id),
      assistantId: row.assistant_id,
      availabilityIncluded: row.availability_included,
      endsAt: row.ends_at ?? undefined,
      ended: row.ended_at === null || row.end_cause === null ? undefined : { at: row.ended_at, cause: row.end_cause },
    });

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: Delegation): DelegationColumns {
    const state = saved.toState();

    return {
      id: saved.id,
      registered_at: state.registeredAt,
      practice_id: state.desk.practiceId,
      practitioner_id: state.desk.practitionerId,
      assistant_id: state.assistantId,
      availability_included: state.availabilityIncluded,
      ends_at: state.endsAt ?? null,
      ended_at: state.ended?.at ?? null,
      end_cause: state.ended?.cause ?? null,
    };
  },
};
