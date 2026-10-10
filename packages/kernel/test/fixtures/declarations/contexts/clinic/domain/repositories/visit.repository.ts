import type { Visit } from '../visit.js';

export abstract class VisitRepository {
  abstract save(visit: Visit): Promise<void>;

  abstract findById(id: string): Promise<Visit | undefined>;
}
