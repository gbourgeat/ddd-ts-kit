import { Repository } from '../../../../../../../src/declarations';
import { VisitRepository } from '../../domain/repositories/visit.repository';
import type { Visit } from '../../domain/visit';

@Repository(VisitRepository)
export class InMemoryVisitRepository implements VisitRepository {
  readonly visits = new Map<string, Visit>();

  async save(visit: Visit): Promise<void> {
    this.visits.set(visit.id, visit);
  }

  async findById(id: string): Promise<Visit | undefined> {
    return this.visits.get(id);
  }
}
