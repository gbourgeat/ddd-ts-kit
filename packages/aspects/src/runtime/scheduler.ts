/** Runs work later. Injected so that a test advances time instead of waiting for it. */
export abstract class Scheduler {
  static readonly tokenKey = 'aspects.Scheduler';

  /** Answers the function that cancels the work. */
  abstract schedule(work: () => void, delayMs: number): () => void;
}
