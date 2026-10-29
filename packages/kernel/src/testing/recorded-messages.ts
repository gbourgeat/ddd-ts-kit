import type { Message } from '../application/messaging/message';
import type { MessageType } from '../application/messaging/message-type';
import type { ResultOf } from '../application/messaging/result-of';

/** What a spec told a recording bus to answer for one type: a method, so that every typed answer sits in one map. */
interface Answer {
  answer(message: Message): unknown;
}

/** The messages a recording bus was handed, in order, and what it answers for each type. */
export class RecordedMessages<M extends Message> {
  readonly list: M[] = [];

  private readonly answers = new Map<unknown, Answer>();

  answer<T extends M>(type: MessageType<T>, answer: (message: T) => ResultOf<T> | Promise<ResultOf<T>>): void {
    this.answers.set(type, { answer });
  }

  async received<T extends M>(message: T): Promise<ResultOf<T>> {
    this.list.push(message);

    const answered: unknown = await this.answers.get(message.constructor)?.answer(message);

    // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- answers of every message type share one map: the link between a type and its result is only known to answer()
    return answered as ResultOf<T>;
  }
}
