import { describe, expect, it } from '{{tests.module}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { RevokeDelegationCommand } from '{{alias.context}}/application/commands/revoke-delegation/revoke-delegation.command{{alias.ext}}';
import { aDelegation } from '{{alias.context}}/test/builders/delegation.builder{{alias.ext}}';
import { aMember } from '{{alias.context}}/test/builders/member.builder{{alias.ext}}';
import { arrangeIdentity } from '{{alias.context}}/test/unit/identity-application{{alias.ext}}';

describe('Revoke delegation', () => {
  it('ends a delegation of the organisation while it holds, and tells the other contexts', async () => {
    const { application, members, delegations, as } = arrangeIdentity();
    const now = application.clock.now();

    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Owner).build());

    await delegations.save(
      aDelegation()
        .identifiedBy('delegation-1')
        .between(now, new Date(now.getTime() + 86_400_000))
        .build(),
    );

    const before = application.eventBus.published.length;

    await application.commandBus.execute(new RevokeDelegationCommand(as('subject-ada'), 'acme', 'delegation-1'));

    expect((await delegations.findById('delegation-1'))?.isActiveAt(now)).toBe(false);
    expect(application.eventBus.published.slice(before)).toMatchObject([{ type: '{{context.kebab}}.delegation.revoked' }]);
  });

  it('finds no delegation of another organisation', async () => {
    const { application, members, delegations, as } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Owner).build());
    await delegations.save(aDelegation().identifiedBy('delegation-1').in('globex').build());

    await expect(
      application.commandBus.execute(new RevokeDelegationCommand(as('subject-ada'), 'acme', 'delegation-1')),
    ).rejects.toMatchObject({ code: 'DELEGATION_NOT_FOUND' });
  });

  it('is refused to a member whose role does not delegate', async () => {
    const { application, members, delegations, as } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-alan').build());
    await delegations.save(aDelegation().identifiedBy('delegation-1').build());

    await expect(
      application.commandBus.execute(new RevokeDelegationCommand(as('subject-alan'), 'acme', 'delegation-1')),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
