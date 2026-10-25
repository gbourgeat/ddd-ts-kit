import type { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#unless style.declared}}
import type { CommandHandler } from '@ddd-ts-kit/kernel';
{{/unless}}
import { Member } from '{{alias.context}}/domain/aggregates/member.aggregate{{alias.ext}}';
import { Organisation } from '{{alias.context}}/domain/aggregates/organisation.aggregate{{alias.ext}}';
{{#unless refusals.named}}
import { AccountError } from '{{alias.context}}/domain/errors/account.error{{alias.ext}}';
import { OrganisationError } from '{{alias.context}}/domain/errors/organisation.error{{alias.ext}}';
{{/unless}}
{{#if refusals.named}}
import { OrganisationSlugTaken } from '{{alias.context}}/domain/errors/organisation-slug-taken.error{{alias.ext}}';
import { UnknownAccount } from '{{alias.context}}/domain/errors/unknown-account.error{{alias.ext}}';
{{/if}}
import type { AccountRepository } from '{{alias.context}}/domain/repositories/account.repository{{alias.ext}}';
import type { MemberRepository } from '{{alias.context}}/domain/repositories/member.repository{{alias.ext}}';
import type { OrganisationRepository } from '{{alias.context}}/domain/repositories/organisation.repository{{alias.ext}}';
import { OrganisationName } from '{{alias.context}}/domain/value-objects/organisation-name.vo{{alias.ext}}';
import { OrganisationSlug } from '{{alias.context}}/domain/value-objects/organisation-slug.vo{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
{{#if style.declared}}
import { OpenOrganisationCommand } from '{{alias.context}}/application/commands/open-organisation/open-organisation.command{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { OpenOrganisationCommand } from '{{alias.context}}/application/commands/open-organisation/open-organisation.command{{alias.ext}}';
{{/unless}}

{{#if style.declared}}
@CommandHandler(OpenOrganisationCommand)
{{/if}}
export class OpenOrganisationHandler implements CommandHandler<OpenOrganisationCommand> {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
    private readonly memberRepository: MemberRepository,
    private readonly accountRepository: AccountRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** The account that opens the organisation is its first owner, in the same unit of work. */
  async execute({ actor, organisation }: OpenOrganisationCommand): Promise<string> {
    const slug = OrganisationSlug.create(organisation.slug);
    const name = OrganisationName.create(organisation.name);
    const opener = await this.accountRepository.findById(actor.id);

    if (opener === undefined) {
{{#if refusals.named}}
      throw UnknownAccount.forAccount(actor.id);
{{/if}}
{{#unless refusals.named}}
      throw AccountError.notFound(actor.id);
{{/unless}}
    }

    opener.assertActive();

    if ((await this.organisationRepository.findById(slug.value)) !== undefined) {
{{#if refusals.named}}
      throw OrganisationSlugTaken.forSlug(slug.value);
{{/if}}
{{#unless refusals.named}}
      throw OrganisationError.slugTaken(slug.value);
{{/unless}}
    }

    const now = this.clock.now();
    const opened = Organisation.open(slug, { name, openedBy: opener.id }, now);
    const owner = Member.join(this.ids.next(), { organisationId: opened.id, accountId: opener.id, role: MemberRole.Owner }, now);

    await this.organisationRepository.save(opened);
    await this.memberRepository.save(owner);

    return opened.id;
  }
}
