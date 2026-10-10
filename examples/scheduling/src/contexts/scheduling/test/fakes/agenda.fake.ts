import { InMemoryReadModelStore } from '@ddd-ts-kit/kernel';
import { agendaCriteria, type Agenda, type AgendaEntry } from '../../application/ports/agenda.port.js';

export class FakeAgenda extends InMemoryReadModelStore<AgendaEntry> implements Agenda {
  constructor() {
    super(agendaCriteria);
  }
}
