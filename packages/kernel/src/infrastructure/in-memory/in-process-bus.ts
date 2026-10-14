import type { BusMiddleware } from '../../application/messaging/bus-middleware.js';
import { DuplicateHandlerError } from '../../application/messaging/duplicate-handler-error.js';
import { HandlerNotFoundError } from '../../application/messaging/handler-not-found-error.js';
import type { HandlerRegistration } from '../../application/messaging/handler-registration.js';
import type { MessageInfo } from '../../application/messaging/message-info.js';
import type { MessageType } from '../../application/messaging/message-type.js';
import type { Message } from '../../application/messaging/message.js';
import type { ResultOf } from '../../application/messaging/result-of.js';
import type { AnyHandler } from './any-handler.js';

export class InProcessBus {
  private readonly handlers = new Map<unknown, AnyHandler>();

  private readonly contexts = new Map<unknown, string>();

  private readonly middlewares: BusMiddleware[] = [];

  private readonly aroundHandlers: BusMiddleware[] = [];

  constructor(private readonly kind: MessageInfo['kind']) {}

  use(middleware: BusMiddleware): this {
    this.middlewares.push(middleware);

    return this;
  }

  /**
   * Runs `middleware` right around the handler, inside every middleware given to `use`, whenever
   * those were added: what has to see the handler itself run, never a middleware that answers
   * in its place.
   */
  aroundHandler(middleware: BusMiddleware): this {
    this.aroundHandlers.push(middleware);

    return this;
  }

  protected add(type: MessageType<Message>, handler: AnyHandler, registration: HandlerRegistration = {}): void {
    if (this.handlers.has(type)) {
      throw new DuplicateHandlerError({ kind: this.kind, name: type.name });
    }

    this.handlers.set(type, handler);

    if (registration.context !== undefined) {
      this.contexts.set(type, registration.context);
    }
  }

  protected dispatch<M extends Message>(message: M): Promise<ResultOf<M>> {
    const context = this.contexts.get(message.constructor);
    const name = message.constructor.name;
    const info: MessageInfo = { kind: this.kind, name, ...(context === undefined ? {} : { context }) };
    const handler = this.handlers.get(message.constructor);

    if (!handler) {
      return Promise.reject(new HandlerNotFoundError(info));
    }

    const run = [...this.middlewares, ...this.aroundHandlers].reduceRight<() => Promise<unknown>>(
      (next, middleware) => () => middleware(message, next, info),
      () => handler.execute(message),
    );

    // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- handlers of every message type share one map and middlewares answer unknown: the link between a message and its result is only known to register()
    return run() as Promise<ResultOf<M>>;
  }
}
