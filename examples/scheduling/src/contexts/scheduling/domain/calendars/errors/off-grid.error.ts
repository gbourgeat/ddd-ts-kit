import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/domain/errors/codes';

export class OffGrid extends DomainRefusal {
  readonly code = SchedulingCodes.OffGrid;

  static forGrid(grid: number) {
    return OffGrid.refusal(`An appointment of this type starts on a step of ${grid} minutes from midnight.`, {
      grid,
    }).exposing('grid');
  }
}
