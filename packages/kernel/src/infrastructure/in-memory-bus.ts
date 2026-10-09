import {
  DuplicateHandlerError,
  HandlerNotFoundError,
  type BusMiddleware,
  type Command,
  type CommandBus,
  type CommandHandler,
  type Message,
  type MessageInfo,
  type MessageType,
  type Query,
  type QueryBus,
  type QueryHandler,
  type ResultOf,
} from '../application/bus.js';

/**
 * Declared with method syntax on purpose: a method parameter is compared bivariantly, so a
 * handler of one message type can be stored next to the handlers of every other type.
 */
interface AnyHandler {
  execute(message: Message): Promise<unknown>;
}

class InProcessBus {
  readonly #handlers = new Map<unknown, AnyHandler>();
  readonly #middlewares: BusMiddleware[] = [];

  constructor(private readonly kind: MessageInfo['kind']) {}

  use(middleware: BusMiddleware): this {
    this.#middlewares.push(middleware);
    return this;
  }

  protected add(type: MessageType<Message>, handler: AnyHandler): void {
    if (this.#handlers.has(type)) {
      throw new DuplicateHandlerError({ kind: this.kind, name: type.name });
    }
    this.#handlers.set(type, handler);
  }

  protected dispatch<M extends Message>(message: M): Promise<ResultOf<M>> {
    const info: MessageInfo = { kind: this.kind, name: message.constructor.name };
    const handler = this.#handlers.get(message.constructor);
    if (!handler) {
      return Promise.reject(new HandlerNotFoundError(info));
    }
    const run = this.#middlewares.reduceRight<() => Promise<unknown>>(
      (next, middleware) => () => middleware(message, next, info),
      () => handler.execute(message),
    );
    // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- handlers of every message type share one map and middlewares answer unknown: the link between a message and its result is only known to register()
    return run() as Promise<ResultOf<M>>;
  }
}

/** One handler per command type, resolved in process. The default CommandBus. */
export class InMemoryCommandBus extends InProcessBus implements CommandBus {
  constructor() {
    super('command');
  }

  register<C extends Command<unknown>>(type: MessageType<C>, handler: CommandHandler<C>): this {
    this.add(type, handler);
    return this;
  }

  execute<C extends Command<unknown>>(command: C): Promise<ResultOf<C>> {
    return this.dispatch(command);
  }
}

export class InMemoryQueryBus extends InProcessBus implements QueryBus {
  constructor() {
    super('query');
  }

  register<Q extends Query<unknown>>(type: MessageType<Q>, handler: QueryHandler<Q>): this {
    this.add(type, handler);
    return this;
  }

  execute<Q extends Query<unknown>>(query: Q): Promise<ResultOf<Q>> {
    return this.dispatch(query);
  }
}

/** Runs every command inside one unit of work. Queries are left alone: they do not write. */
export function unitOfWorkMiddleware(unitOfWork: {
  run<T>(work: () => Promise<T>): Promise<T>;
}): BusMiddleware {
  return (_message, next, info) => (info.kind === 'command' ? unitOfWork.run(next) : next());
}
