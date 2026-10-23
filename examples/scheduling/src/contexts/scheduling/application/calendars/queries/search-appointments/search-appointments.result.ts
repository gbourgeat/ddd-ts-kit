import type { Page } from '@ddd-ts-kit/kernel';
import type { AgendaEntry } from '@/contexts/scheduling/application/calendars/ports/agenda.port';

export type SearchAppointmentsResult = Page<AgendaEntry>;
