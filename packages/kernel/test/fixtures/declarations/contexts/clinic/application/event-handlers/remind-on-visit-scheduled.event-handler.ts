import { DomainEventHandler } from '../../../../../../../src/declarations.js';
import { VisitScheduled } from '../../domain/events/visit-scheduled.event.js';
import { Reminders } from '../ports/reminders.port.js';

@DomainEventHandler(VisitScheduled, [Reminders])
export class RemindOnVisitScheduled implements DomainEventHandler<VisitScheduled> {
  constructor(private readonly reminders: Reminders) {}

  async handle(event: VisitScheduled): Promise<void> {
    await this.reminders.remind(event.aggregateId);
  }
}
