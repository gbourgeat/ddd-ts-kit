import type { MessageType } from '../application/messaging/message-type';
import type { Query } from '../application/messaging/query';
import type { ResultOf } from '../application/messaging/result-of';
import { QueryBus } from '../application/ports/query-bus';
import { RecordedMessages } from './recorded-messages';

/**
 * The query bus of a spec that asserts what a class asks, a controller most often: it keeps
 * every query it is handed, in order, and answers what the spec told it to, `undefined` for a
 * type it was told nothing about.
 *
 *     const queries = new RecordingQueryBus().answering(GetInvoiceQuery, () => invoice);
 *
 * No handler runs: what the query reads is the spec of its own handler.
 */
export class RecordingQueryBus extends QueryBus {
  private readonly recorded = new RecordedMessages<Query<unknown>>();

  /** Every query executed so far, in order. */
  get executed(): readonly Query<unknown>[] {
    return this.recorded.list;
  }

  /**
   * What the bus answers for each query of `type` from now on, or the refusal the function throws.
   * Told twice, the last answer holds. A subclass of `type` is answered the same, unless told an
   * answer of its own.
   */
  answering<Q extends Query<unknown>>(
    type: MessageType<Q>,
    answer: (query: Q) => ResultOf<Q> | Promise<ResultOf<Q>>,
  ): this {
    this.recorded.answer(type, answer);

    return this;
  }

  execute<Q extends Query<unknown>>(query: Q): Promise<ResultOf<Q>> {
    return this.recorded.received(query);
  }
}
