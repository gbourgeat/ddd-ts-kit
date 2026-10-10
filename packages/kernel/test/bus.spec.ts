import { describe, expect, it } from 'vitest';
import {
  Command,
  DuplicateHandlerError,
  HandlerNotFoundError,
  InMemoryCommandBus,
  InMemoryQueryBus,
  Query,
  unitOfWorkMiddleware,
} from '../src/index.js';

class PlaceOrder extends Command<string> {
  constructor(readonly sku: string) {
    super();
  }
}

class CancelOrder extends Command {
  constructor(readonly orderId: string) {
    super();
  }
}

class GetOrder extends Query<{ id: string }> {
  constructor(readonly id: string) {
    super();
  }
}

describe('InMemoryCommandBus', () => {
  it('routes a command to its handler and types the answer', async () => {
    const bus = new InMemoryCommandBus().register(PlaceOrder, {
      execute: async (command) => `order-for-${command.sku}`,
    });

    const id: string = await bus.execute(new PlaceOrder('sku-1'));

    expect(id).toBe('order-for-sku-1');
  });

  it('refuses a command without handler and a second handler for the same command', async () => {
    const bus = new InMemoryCommandBus().register(CancelOrder, { execute: async () => undefined });

    await expect(bus.execute(new PlaceOrder('x'))).rejects.toBeInstanceOf(HandlerNotFoundError);

    expect(() => bus.register(CancelOrder, { execute: async () => undefined })).toThrow(
      DuplicateHandlerError,
    );
  });

  it('runs middlewares outside in, around the handler', async () => {
    const trace: string[] = [];

    const bus = new InMemoryCommandBus()
      .use(async (_m, next) => {
        trace.push('a>');
        const result = await next();

        trace.push('<a');

        return result;
      })
      .use(async (_m, next, info) => {
        trace.push(info.name);

        return next();
      })
      .register(CancelOrder, { execute: async () => void trace.push('handler') });

    await bus.execute(new CancelOrder('o1'));
    expect(trace).toEqual(['a>', 'CancelOrder', 'handler', '<a']);
  });

  it('opens a unit of work for commands only', async () => {
    let opened = 0;

    const middleware = unitOfWorkMiddleware({
      run: (work) => {
        opened += 1;

        return work();
      },
    });

    const commands = new InMemoryCommandBus().use(middleware).register(CancelOrder, { execute: async () => undefined });
    const queries = new InMemoryQueryBus().use(middleware).register(GetOrder, { execute: async (q) => ({ id: q.id }) });

    await commands.execute(new CancelOrder('o1'));
    expect(await queries.execute(new GetOrder('o1'))).toEqual({ id: 'o1' });
    expect(opened).toBe(1);
  });
});
