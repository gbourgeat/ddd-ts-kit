import { InMemoryReadModelStore } from '@ddd-ts-kit/kernel';
import { outcomeCriteria, type Outcome, type OutcomeRegister } from '../../application/ports/outcome-register.port.js';

export class FakeOutcomeRegister extends InMemoryReadModelStore<Outcome> implements OutcomeRegister {
  constructor() {
    super(outcomeCriteria);
  }
}
