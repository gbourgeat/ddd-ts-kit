import { describe, expect, it } from '{{tests.module}}';
import { organisationOpenedV1 } from '{{alias.context}}/published-language/organisation-opened.v1.integration-event{{alias.ext}}';
import { startedIdentity } from '{{alias.context}}/test/worlds/{{context.kebab}}.world{{alias.ext}}';

const opening = organisationOpenedV1.create(
  { organisationId: 'acme', name: 'Acme', openedBy: 'subject-ada' },
  { id: 'event-1', occurredAt: '2026-01-01T00:00:00.000Z' },
);

describe('When an organisation is opened, the identity provider follows', () => {
  it('learns the organisation under its slug once, asked again after a failure until it answers', async () => {
    const { application, identityProvider } = await startedIdentity();

    const outage = new Error('provider unreachable');

    identityProvider.failWith(outage);

    await expect(application.eventBus.publish([opening])).rejects.toBe(outage);

    identityProvider.answerAgain();
    await application.eventBus.publish([opening]);
    await application.eventBus.publish([opening]);

    expect(identityProvider.asked).toEqual(['open acme named Acme']);
  });
});
