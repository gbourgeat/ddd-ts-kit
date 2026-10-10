import { Repository } from '@ddd-ts-kit/kernel';
import type { Calendar } from '#src/contexts/scheduling/domain/aggregates/calendar.aggregate.js';

export abstract class CalendarRepository extends Repository<Calendar> {}
