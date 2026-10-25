import type { AuditStamp } from '@ddd-ts-kit/kernel';
import { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';
import type { {{context.pascal}}Member as MemberRow } from '{{alias.generated}}/prisma/client{{alias.ext}}';

export type MemberColumns = Omit<MemberRow, 'version' | keyof AuditStamp>;

export const MemberMapper = {
  toDomain(row: MemberRow): Member {
    const loaded = Member.rehydrate(row.id, {
      organisationId: row.organisationId,
      accountId: row.accountId,
      role: row.role,
      joinedAt: row.joinedAt,
      removedAt: row.removedAt ?? undefined,
    });

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: Member): MemberColumns {
    const state = saved.toState();

    return {
      id: saved.id,
      organisationId: state.organisationId,
      accountId: state.accountId,
      role: state.role,
      joinedAt: state.joinedAt,
      removedAt: state.removedAt ?? null,
    };
  },
};
