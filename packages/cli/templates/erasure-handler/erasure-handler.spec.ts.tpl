import { describe, expect, it } from '{{tests.module}}';
import { dataSubjectErasedV1 } from '@ddd-ts-kit/kernel';
import { DataSubjectErasedIntegrationHandler } from '{{alias.context}}/application/integration/handlers/data-subject-erased.integration-handler{{alias.ext}}';
import { {{personal.names.fake}} } from '{{alias.context}}/test/fakes/{{personal.names.portKebab}}.fake{{alias.ext}}';

const at = '2026-01-01T00:00:00.000Z';

describe('When the platform announces the erasure of a person', () => {
  it('listens to the type the platform publishes', () => {
    expect(DataSubjectErasedIntegrationHandler.eventType).toBe('privacy.data-subject.erased');
  });

  it('erases what {{context.kebab}} keeps of that person, and of nobody else', async () => {
    const erasure = new {{personal.names.fake}}().holds('person-1', 2).holds('person-2', 1);

    await new DataSubjectErasedIntegrationHandler(erasure).handle(erasureOf('person-1'));

    expect(erasure.erased).toEqual(['person-1']);
    expect(await erasure.erase('person-2')).toBe(1);
  });

  it('reaches nothing when the same erasure is delivered again: delivery is at least once', async () => {
    const erasure = new {{personal.names.fake}}().holds('person-1', 2);
    const handler = new DataSubjectErasedIntegrationHandler(erasure);

    await handler.handle(erasureOf('person-1'));
    await handler.handle(erasureOf('person-1'));

    expect(await erasure.erase('person-1')).toBe(0);
  });
});

/** The erasure of a person as the platform announces it. */
function erasureOf(subjectId: string, id = 'event-1') {
  return dataSubjectErasedV1.create({ subjectId, erasedAt: at }, { id, occurredAt: at });
}
