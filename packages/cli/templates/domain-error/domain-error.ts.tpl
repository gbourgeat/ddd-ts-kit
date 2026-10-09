import { DomainError } from '@ddd-ts-kit/kernel';

export class {{name.pascal}}Error extends DomainError {
  readonly code = '{{error.code}}';

  constructor() {
    // TODO(domain): take as parameters the facts that explain the refusal (which {{context.words}} rule, which value) and write a message a domain expert would recognise; the code above is the stable contract.
    super('{{name.title}}.');
  }
}
