import type { MessageInfo } from '@ddd-ts-kit/kernel';

/** A protected command or query was sent without its actor. A programming error, not a refusal. */
export class MissingActorError extends Error {
  constructor(info: MessageInfo) {
    super(
      `The ${info.kind} ${info.name} requires a permission but carries no actor. Extend AuthorizedCommand or AuthorizedQuery.`,
    );

    this.name = 'MissingActorError';
  }
}
