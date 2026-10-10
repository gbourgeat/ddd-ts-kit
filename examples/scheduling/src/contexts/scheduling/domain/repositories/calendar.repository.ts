import { Repository } from '@ddd-ts-kit/kernel';
import type { Calendar } from '../aggregates/calendar.aggregate.js';

export abstract class CalendarRepository extends Repository<Calendar> {}
