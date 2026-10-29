import type { UseCaseFact } from '../describe/context-description';
import { toName } from '../naming';

/** `CancelInvoice` is `cancel-invoice`: the name the files of a use case and their specs carry. */
export function kebabOfUseCase(useCase: UseCaseFact): string {
  return toName(useCase.name).kebab;
}
