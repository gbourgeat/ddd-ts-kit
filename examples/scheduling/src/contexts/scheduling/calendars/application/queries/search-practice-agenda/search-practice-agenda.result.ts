import type { Page } from '@ddd-ts-kit/kernel';
import type { AgendaEntry } from '@/contexts/scheduling/calendars/application/ports/agenda.port';

export type SearchPracticeAgendaResult = Page<AgendaEntry>;
