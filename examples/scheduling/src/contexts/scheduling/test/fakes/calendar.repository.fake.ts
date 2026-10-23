import { InMemoryRepository } from '@ddd-ts-kit/testing';
import { Calendar } from '@/contexts/scheduling/domain/calendars/aggregates/calendar.aggregate';
import type { CalendarRepository } from '@/contexts/scheduling/domain/calendars/repositories/calendar.repository';

export class FakeCalendarRepository extends InMemoryRepository<Calendar> implements CalendarRepository {
  constructor() {
    // A copy by rehydration and not a snapshot: the state holds value objects, which a structured clone would turn into plain data.
    super({ clone: (stored: Calendar) => Calendar.rehydrate(stored.id, stored.toState()) });
  }
}
