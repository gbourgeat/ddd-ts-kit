/**
 * When a handler of a domain event runs, relative to the commit of the unit of work that
 * recorded the event.
 *
 * `before-commit`, the default: at the end of the unit of work, inside its transaction. What the
 * handler writes commits or rolls back with the state change, and its failure fails the command.
 *
 * `after-commit`: once the transaction has committed, never when it rolled back. For a local
 * effect no transaction covers (a cache, a remote call). At most once: a crash between the commit
 * and the run loses it, and its failure is reported without failing the command. What must not be
 * lost goes through the outbox as an integration event.
 */
export type DomainEventPhase = 'before-commit' | 'after-commit';
