import { InMemoryReadModelStore } from '@ddd-ts-kit/kernel';
import {
  agendaCriteria,
  type Agenda,
  type AgendaEntry,
} from '@/contexts/scheduling/application/calendars/ports/agenda.port';

export class FakeAgenda extends InMemoryReadModelStore<AgendaEntry> implements Agenda {
  constructor() {
    super(agendaCriteria);
  }
}
