import { describe, expect, it } from '{{tests.module}}';
import { memberRemovedV1 } from '{{alias.context}}/published-language/member-removed.v1.integration-event{{alias.ext}}';
import { aMember } from '{{alias.context}}/test/builders/member.builder{{alias.ext}}';
import { arrangeIdentity, startedIdentity } from '{{alias.context}}/test/worlds/{{context.kebab}}.world{{alias.ext}}';

const removal = memberRemovedV1.create(
  { memberId: 'member-1', organisationId: 'acme', accountId: 'subject-alan' },
  { id: 'event-1', occurredAt: '2026-01-01T00:00:00.000Z' },
);

describe('When a member is removed, the identity provider follows', () => {
  it('takes the person out of the organisation once, even when the fact is delivered twice', async () => {
    const { application, identityProvider } = await startedIdentity();

    await application.eventBus.publish([removal]);
    await application.eventBus.publish([removal]);

    expect(identityProvider.asked).toEqual(['remove subject-alan from acme']);
  });

  it('is asked again after a failure, until the provider is in line: the revocation is never lost', async () => {
    const { application, identityProvider } = await startedIdentity();

    identityProvider.failWith(new Error('provider unreachable'));

    // The failure goes back to who delivered the fact (the outbox relay, the broker), which delivers it again later.
    await expect(application.eventBus.publish([removal])).rejects.toThrow();
    await expect(application.eventBus.publish([removal])).rejects.toThrow();

    identityProvider.answerAgain();
    await application.eventBus.publish([removal]);

    expect(identityProvider.asked).toEqual(['remove subject-alan from acme']);
  });

  it('leaves in a person who joined the organisation again since: the context holds the membership now', async () => {
    const { application, members, identityProvider } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-alan').build());
    await application.start();
    await application.eventBus.publish([removal]);

    expect(identityProvider.asked).toEqual([]);
  });
});
