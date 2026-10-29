import type { Command } from '../application/messaging/command';
import type { MessageType } from '../application/messaging/message-type';
import type { ResultOf } from '../application/messaging/result-of';
import { CommandBus } from '../application/ports/command-bus';
import { RecordedMessages } from './recorded-messages';

/**
 * The command bus of a spec that asserts what a class sends, a reaction or a controller: it
 * keeps every command it is handed, in order, and answers what the spec told it to, `undefined`
 * for a type it was told nothing about. The fact given, the command recorded asserted:
 *
 *     const commands = new RecordingCommandBus();
 *
 *     await new InvoiceIssuedEventHandler(commands).handle(issued);
 *
 *     expect(commands.executed).toEqual([new ScheduleReminderCommand(reminder, 'invoice-1')]);
 *
 * No handler runs: what the command does is the spec of its own handler.
 */
export class RecordingCommandBus extends CommandBus {
  private readonly recorded = new RecordedMessages<Command<unknown>>();

  /** Every command executed so far, in order. */
  get executed(): readonly Command<unknown>[] {
    return this.recorded.list;
  }

  /**
   * What the bus answers for each command of `type` from now on: an identifier, nothing, or a
   * refusal the function throws. Told twice, the last answer holds. A subclass of `type` is
   * answered the same, unless told an answer of its own.
   */
  answering<C extends Command<unknown>>(
    type: MessageType<C>,
    answer: (command: C) => ResultOf<C> | Promise<ResultOf<C>>,
  ): this {
    this.recorded.answer(type, answer);

    return this;
  }

  execute<C extends Command<unknown>>(command: C): Promise<ResultOf<C>> {
    return this.recorded.received(command);
  }
}
