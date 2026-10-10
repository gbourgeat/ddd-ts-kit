import { describe, expect, it } from 'vitest';
import { CalendarCreatedEventHandler } from '../../application/event-handlers/calendar-created.event-handler.js';
import { CalendarCreated } from '../../domain/events/calendar-created.event.js';
import { FakeSchedulingRelationships } from '../fakes/scheduling-relationships.fake.js';

const created = new CalendarCreated('calendar-1', new Date('2026-01-01T00:00:00.000Z'), 'practice-4', 'practitioner-5', 'Europe/Paris');

describe('When calendar created', () => {
  it('records the desk and the practice the calendar belongs to', async () => {
    const relationships = new FakeSchedulingRelationships();
    const handler = new CalendarCreatedEventHandler(relationships);

    await handler.handle(created);

    expect(relationships.current).toEqual(['calendar calendar-1 of desk practice-4.practitioner-5', 'calendar calendar-1 of practice practice-4']);
  });

  it('knows nothing more when the same fact comes twice', async () => {
    const relationships = new FakeSchedulingRelationships();
    const handler = new CalendarCreatedEventHandler(relationships);

    await handler.handle(created);
    await handler.handle(created);

    expect(relationships.current).toHaveLength(2);
  });
});
