import { describe, expect, it } from '{{tests.module}}';
import { accountDeactivatedV1 } from '{{alias.context}}/published-language/account-deactivated.v1.integration-event{{alias.ext}}';
import { startedIdentity } from '{{alias.context}}/test/worlds/{{context.kebab}}.world{{alias.ext}}';

const deactivation = accountDeactivatedV1.create(
  { accountId: 'subject-ada' },
  { id: 'event-1', occurredAt: '2026-01-01T00:00:00.000Z' },
);

describe('When an account is deactivated, the identity provider follows', () => {
  it('disables the person once, asked again after a failure until it answers: a deactivation is never lost', async () => {
    const { application, identityProvider } = await startedIdentity();

    identityProvider.failWith(new Error('provider unreachable'));

    await expect(application.eventBus.publish([deactivation])).rejects.toThrow();

    identityProvider.answerAgain();
    await application.eventBus.publish([deactivation]);
    await application.eventBus.publish([deactivation]);

    expect(identityProvider.asked).toEqual(['disable subject-ada']);
  });
});
