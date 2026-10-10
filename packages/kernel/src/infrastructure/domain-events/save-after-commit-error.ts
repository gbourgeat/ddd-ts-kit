/**
 * An `after-commit` handler of a domain event handed an aggregate to a repository. The unit of
 * work is over: nothing would dispatch what the aggregate recorded, and nothing would roll the
 * write back. Such a handler sends a command through the command bus, which opens a unit of work
 * of its own.
 */
export class SaveAfterCommitError extends Error {
  constructor(method: string) {
    super(
      `An after-commit domain event handler called "${method}" with an aggregate: the unit of work is over. Send a command through the command bus instead, or declare the handler in the before-commit phase.`,
    );

    this.name = 'SaveAfterCommitError';
  }
}
