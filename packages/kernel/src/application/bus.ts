declare const RESULT: unique symbol;
declare const KIND: unique symbol;

/** An intention to change state. `R` is what the handler answers: nothing or an identifier. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- R is a phantom type: it only exists so that ResultOf<C> can infer what the handler answers
export abstract class Command<R = void> {
  declare readonly [RESULT]?: R;
  declare readonly [KIND]?: 'command';
}

/** A question. Answering it never changes state. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- R is a phantom type: it only exists so that ResultOf<Q> can infer what the handler answers
export abstract class Query<R> {
  declare readonly [RESULT]?: R;
  declare readonly [KIND]?: 'query';
}

export type Message = Command<unknown> | Query<unknown>;
export type ResultOf<M> = M extends { readonly [RESULT]?: infer R } ? R : never;
export type MessageType<M extends Message> = abstract new (...args: never[]) => M;

export interface CommandHandler<C extends Command<unknown>> {
  execute(command: C): Promise<ResultOf<C>>;
}

export interface QueryHandler<Q extends Query<unknown>> {
  execute(query: Q): Promise<ResultOf<Q>>;
}

/**
 * Driving ports of the application layer. Presentation and consumers depend on these,
 * never on a handler class, so the transport behind (in-process, queue, RPC) is a wiring choice.
 */
export interface CommandBus {
  execute<C extends Command<unknown>>(command: C): Promise<ResultOf<C>>;
}

export interface QueryBus {
  execute<Q extends Query<unknown>>(query: Q): Promise<ResultOf<Q>>;
}

export interface MessageInfo {
  readonly kind: 'command' | 'query';
  readonly name: string;
}

/** Cross-cutting behaviour (unit of work, logging, authorization) around every handler. */
export type BusMiddleware = (
  message: Message,
  next: () => Promise<unknown>,
  info: MessageInfo,
) => Promise<unknown>;

export class HandlerNotFoundError extends Error {
  constructor(info: MessageInfo) {
    super(`No handler registered for ${info.kind} ${info.name}`);
    this.name = 'HandlerNotFoundError';
  }
}

export class DuplicateHandlerError extends Error {
  constructor(info: MessageInfo) {
    super(`A handler is already registered for ${info.kind} ${info.name}`);
    this.name = 'DuplicateHandlerError';
  }
}
