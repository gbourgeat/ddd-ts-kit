import type { MessageInfo } from '@ddd-ts-kit/kernel';

/**
 * A command or query reached the bus without `requires` or `publicUseCase`. A programming
 * error, not a refusal: it must fail a test, never be answered as a 403.
 */
export class UndeclaredUseCaseError extends Error {
  constructor(info: MessageInfo) {
    super(
      `The ${info.kind} ${info.name} declares no access. Declare it with requires(${info.name}, permission) or publicUseCase(${info.name}).`,
    );

    this.name = 'UndeclaredUseCaseError';
  }
}
