import type { Page } from '@ddd-ts-kit/kernel';
import type { AgendaEntry } from '#src/contexts/scheduling/application/ports/agenda.port.js';

export type SearchPracticeAgendaResult = Page<AgendaEntry>;
