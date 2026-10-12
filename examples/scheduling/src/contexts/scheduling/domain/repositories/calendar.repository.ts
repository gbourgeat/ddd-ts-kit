import { Repository } from '@ddd-ts-kit/kernel';
import type { Calendar } from '@/contexts/scheduling/domain/aggregates/calendar.aggregate';

export abstract class CalendarRepository extends Repository<Calendar> {}
