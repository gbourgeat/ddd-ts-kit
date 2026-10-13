import type { BackgroundJob, BackgroundJobExecution, JobExecution, Message, ScheduledJob } from '@ddd-ts-kit/kernel';
import type { IntegrationEventHandler, MessageHandler, Token } from '@ddd-ts-kit/kernel/declarations';

/*
 * What a handler built by a factory is bound under: no class of the project names it, so a
 * class is made for the statement and reads, in an error or a description, as that statement.
 */

export function messageHandlerOf<M extends Message>(statement: string): Token<MessageHandler<M>> {
  abstract class FactoryMade implements MessageHandler<M> {
    abstract readonly execute: MessageHandler<M>['execute'];
  }

  return named(FactoryMade, statement);
}

export function integrationEventHandlerOf<Payload>(statement: string): Token<IntegrationEventHandler<Payload>> {
  abstract class FactoryMade implements IntegrationEventHandler<Payload> {
    abstract readonly handle: IntegrationEventHandler<Payload>['handle'];
  }

  return named(FactoryMade, statement);
}

export function jobOf(statement: string): Token<ScheduledJob> {
  abstract class FactoryMade implements ScheduledJob {
    abstract run(execution: JobExecution): Promise<void>;
  }

  return named(FactoryMade, statement);
}

export function backgroundJobOf(statement: string): Token<BackgroundJob<unknown>> {
  abstract class FactoryMade implements BackgroundJob<unknown> {
    abstract run(payload: unknown, execution: BackgroundJobExecution): Promise<void>;
  }

  return named(FactoryMade, statement);
}

function named<Made extends Token<unknown>>(made: Made, statement: string): Made {
  Object.defineProperty(made, 'name', { value: `${statement} handler` });

  return made;
}
