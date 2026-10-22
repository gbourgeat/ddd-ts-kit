import { DomainEventHandler } from '../../../../../../../src/declarations';
import { VisitScheduled } from '../../domain/events/visit-scheduled.event';
import { Reminders } from '../ports/reminders.port';

@DomainEventHandler(VisitScheduled, [Reminders])
export class RemindOnVisitScheduled implements DomainEventHandler<VisitScheduled> {
  constructor(private readonly reminders: Reminders) {}

  async handle(event: VisitScheduled): Promise<void> {
    await this.reminders.remind(event.aggregateId);
  }
}
