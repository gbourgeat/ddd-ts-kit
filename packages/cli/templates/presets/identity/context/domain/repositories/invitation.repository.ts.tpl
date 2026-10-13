import { Repository } from '@ddd-ts-kit/kernel';
import type { Invitation } from '{{alias.context}}/domain/aggregates/invitation.aggregate{{alias.ext}}';

export abstract class InvitationRepository extends Repository<Invitation> {
  /** The invitation whose token has this digest. */
  abstract findByTokenHash(tokenHash: string): Promise<Invitation | undefined>;
}
