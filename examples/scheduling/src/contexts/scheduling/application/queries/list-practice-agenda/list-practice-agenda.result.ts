import type { Page } from '@ddd-ts-kit/kernel';
import type { AgendaEntry } from '../../ports/agenda.port.js';

export type ListPracticeAgendaResult = Page<AgendaEntry>;
