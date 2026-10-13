import type { AgendaEntry } from '@/contexts/scheduling/application/ports/agenda.port';

/** The entries of the agenda, one page of the read model after the other, as the reader asks for them. */
export type ExportPracticeAgendaResult = AsyncIterable<AgendaEntry>;
