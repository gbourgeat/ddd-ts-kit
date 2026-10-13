import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import type { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';
import { AccountError } from '{{alias.context}}/domain/errors/account.error{{alias.ext}}';
import { OrganisationError } from '{{alias.context}}/domain/errors/organisation.error{{alias.ext}}';
import type { AccountRepository } from '{{alias.context}}/domain/repositories/account.repository{{alias.ext}}';
import type { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import type { OrganisationRepository } from '{{alias.context}}/domain/repositories/organisation.repository{{alias.ext}}';
import { DeactivateAccountCommand } from '{{alias.context}}/application/commands/deactivate-account/deactivate-account.command{{alias.ext}}';

@CommandHandler(DeactivateAccountCommand)
export class DeactivateAccountHandler implements CommandHandler<DeactivateAccountCommand> {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly organisationRepository: OrganisationRepository,
    private readonly memberRepository: MemberRepository,
    private readonly delegationRepository: DelegationRepository,
    private readonly clock: Clock,
  ) {}

  /**
   * A person deactivates their own account, which leaves every organisation it belongs to and ends
   * every delegation it gave or received there, in the same unit of work: a deactivated account
   * holds no right anywhere, whatever its token says until it expires. The last owner of an
   * organisation is refused: they appoint another owner first. The provider is asked to disable
   * the person once it is committed (`application/integration/handlers/`).
   */
  async execute({ actor }: DeactivateAccountCommand): Promise<string> {
    const account = await this.accountRepository.findById(actor.id);

    if (account === undefined) {
      throw AccountError.notFound(actor.id);
    }

    const now = this.clock.now();

    account.deactivate(now);

    for (const member of await this.memberRepository.searchCurrentOf(account.id)) {
      await this.leave(member, now);
    }

    await this.accountRepository.save(account);

    return account.id;
  }

  /** As a removal: the organisation saved unchanged orders the changes of its owners. */
  private async leave(member: Member, now: Date): Promise<void> {
    const { organisationId, accountId } = member;
    const organisation = await this.organisationRepository.findById(organisationId);

    if (organisation === undefined) {
      throw OrganisationError.notFound(organisationId);
    }

    const owners = await this.memberRepository.countOwners(organisationId);

    member.remove({ by: member.role, byAccount: accountId, delegationId: undefined, owners }, now);
    await this.organisationRepository.save(organisation);
    await this.memberRepository.save(member);

    for (const delegation of await this.delegationRepository.findUnendedInvolving(organisationId, accountId)) {
      delegation.end(now);
      await this.delegationRepository.save(delegation);
    }
  }
}
