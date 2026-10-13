import { Delegation } from '{{alias.context}}/domain/aggregates/delegation.aggregate{{alias.ext}}';
import { DelegationPeriod } from '{{alias.context}}/domain/value-objects/delegation-period.vo{{alias.ext}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import type { DelegationColumns, DelegationRow } from '{{alias.context}}/infrastructure/persistence/delegation-row.schema{{alias.ext}}';

const SEPARATOR = ',';

export const DelegationMapper = {
  toDomain(row: DelegationRow): Delegation {
    const loaded = Delegation.rehydrate(row.id, {
      organisationId: row.organisation_id,
      delegatorId: row.delegator_id,
      delegateId: row.delegate_id,
      rights: rightsOf(row.rights),
      period: DelegationPeriod.create(row.starts_at, row.ends_at),
      endedAt: row.ended_at ?? undefined,
    });

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: Delegation): DelegationColumns {
    const state = saved.toState();

    return {
      id: saved.id,
      organisation_id: state.organisationId,
      delegator_id: state.delegatorId,
      delegate_id: state.delegateId,
      rights: state.rights.join(SEPARATOR),
      starts_at: state.period.startsAt,
      ends_at: state.period.endsAt,
      ended_at: state.endedAt ?? null,
    };
  },
};

/** The rights of a stored delegation, those the vocabulary no longer names left out. */
function rightsOf(stored: string): MemberRight[] {
  const lent = stored.split(SEPARATOR);

  return Object.values(MemberRight).filter((right) => lent.includes(right));
}
