/** What JetStream needs of the server: writing to the clients that subscribed. */
export interface Outbox {
  /** Writes a message routed to `target` (an inbox, or the subject itself); returns how many got it. */
  deliver(
    target: string,
    subject: string,
    reply: string | undefined,
    headers: Buffer | undefined,
    data: Buffer,
  ): number;
  /** Whether some client still subscribes to `target`, an inbox a pull request named. */
  listens(target: string): boolean;
}
