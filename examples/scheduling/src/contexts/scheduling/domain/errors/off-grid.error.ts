import { DomainError } from '@ddd-ts-kit/kernel';

export class OffGridError extends DomainError {
  readonly code = 'OFF_GRID';

  constructor(grid: number) {
    super(`An appointment of this type starts on a step of ${grid} minutes from midnight.`);
  }
}
