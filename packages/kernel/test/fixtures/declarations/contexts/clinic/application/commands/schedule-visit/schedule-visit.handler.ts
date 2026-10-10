import { Clock } from '../../../../../../../../src/index.js';
import { CommandHandler } from '../../../../../../../../src/declarations.js';
import { VisitRepository } from '../../../domain/repositories/visit.repository.js';
import { ScheduleVisit } from './schedule-visit.command.js';

@CommandHandler(ScheduleVisit, [VisitRepository, Clock])
export class ScheduleVisitHandler implements CommandHandler<ScheduleVisit> {
  constructor(
    private readonly visits: VisitRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: ScheduleVisit): Promise<string> {
    const id = `visit-${this.clock.now().getTime()}`;

    await this.visits.save({ id, patientId: command.patientId, startsAt: command.startsAt });

    return id;
  }
}
