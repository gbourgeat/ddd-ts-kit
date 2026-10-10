import { InMemoryRepository } from '@ddd-ts-kit/testing';
import { Calendar } from '#src/contexts/scheduling/domain/aggregates/calendar.aggregate.js';
import type { CalendarRepository } from '#src/contexts/scheduling/domain/repositories/calendar.repository.js';

export class FakeCalendarRepository extends InMemoryRepository<Calendar> implements CalendarRepository {
  constructor() {
    // A copy by rehydration and not a snapshot: the state holds value objects, which a structured clone would turn into plain data.
    super({ clone: (stored: Calendar) => Calendar.rehydrate(stored.id, stored.toState()) });
  }
}
