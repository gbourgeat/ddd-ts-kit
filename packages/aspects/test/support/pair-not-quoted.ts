import { DomainError } from '@ddd-ts-kit/kernel';

/** A business refusal: the dependency answered. */
export class PairNotQuoted extends DomainError {
  readonly code = 'PAIR_NOT_QUOTED';

  constructor() {
    super('No quote for the pair asked by customer 4111-1111');
  }
}
