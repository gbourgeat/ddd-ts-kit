import type { Message } from '../application/messaging/message';
import type { MessageType } from '../application/messaging/message-type';
import type { ResultOf } from '../application/messaging/result-of';

/** What a spec told a recording bus to answer for one type: a method, so that every typed answer sits in one map. */
interface Answer {
  answer(message: Message): unknown;
}

/**
 * The messages a recording bus was handed, in order, and what it answers for each type: the
 * answer told for the class of a message, else for the nearest class above it; a message no
 * answer covers is recorded all the same and answered `undefined`.
 */
export class RecordedMessages<M extends Message> {
  readonly list: M[] = [];

  private readonly answers = new Map<unknown, Answer>();

  answer<T extends M>(type: MessageType<T>, answer: (message: T) => ResultOf<T> | Promise<ResultOf<T>>): void {
    this.answers.set(type, { answer });
  }

  async received<T extends M>(message: T): Promise<ResultOf<T>> {
    this.list.push(message);

    const answered: unknown = await this.answerOf(message)?.answer(message);

    // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- answers of every message type share one map: the link between a type and its result is only known to answer()
    return answered as ResultOf<T>;
  }

  /** The answer told for the class of the message or, failing that, for the nearest class above it. */
  private answerOf(message: Message): Answer | undefined {
    for (let type: unknown = message.constructor; typeof type === 'function'; type = Object.getPrototypeOf(type)) {
      const answer = this.answers.get(type);

      if (answer !== undefined) {
        return answer;
      }
    }

    return undefined;
  }
}
