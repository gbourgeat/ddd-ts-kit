import { describe, expect, it } from 'vitest';
import { Command, CommandBus, Query, QueryBus } from '../src';
import { RecordingCommandBus, RecordingQueryBus } from '../src/testing';

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

class OrderAlreadyShipped extends Error {}

describe('RecordingCommandBus', () => {
  it('keeps every command it is handed, in order, and stands where a command bus is expected', async () => {
    const commands = new RecordingCommandBus();
    const bus: CommandBus = commands;

    await bus.execute(new PlaceOrder('sku-1'));
    await bus.execute(new CancelOrder('order-1'));

    expect(commands).toBeInstanceOf(CommandBus);
    expect(commands.executed).toEqual([new PlaceOrder('sku-1'), new CancelOrder('order-1')]);
  });

  it('answers nothing for a command it was told nothing about', async () => {
    const commands = new RecordingCommandBus();

    await expect(commands.execute(new PlaceOrder('sku-1'))).resolves.toBeUndefined();
  });

  it('answers what the spec told it for each command of a type, from the command itself', async () => {
    const commands = new RecordingCommandBus().answering(PlaceOrder, (command) => `order-for-${command.sku}`);

    const id: string = await commands.execute(new PlaceOrder('sku-2'));

    expect(id).toBe('order-for-sku-2');
    await expect(commands.execute(new CancelOrder('order-1'))).resolves.toBeUndefined();
  });

  it('keeps the last answer it was told, and records a command it answers with a refusal', async () => {
    const refusal = new OrderAlreadyShipped();

    const commands = new RecordingCommandBus()
      .answering(CancelOrder, () => undefined)
      .answering(CancelOrder, () => Promise.reject(refusal));

    await expect(commands.execute(new CancelOrder('order-1'))).rejects.toBe(refusal);
    expect(commands.executed).toEqual([new CancelOrder('order-1')]);
  });
});

describe('RecordingQueryBus', () => {
  it('keeps every query it is handed and answers what the spec told it, nothing otherwise', async () => {
    const queries = new RecordingQueryBus().answering(GetOrder, async (query) => ({ id: query.id }));
    const bus: QueryBus = queries;

    const order = await bus.execute(new GetOrder('order-1'));

    expect(queries).toBeInstanceOf(QueryBus);
    expect(order).toEqual({ id: 'order-1' });
    expect(queries.executed).toEqual([new GetOrder('order-1')]);
  });

  it('answers nothing for a query it was told nothing about', async () => {
    await expect(new RecordingQueryBus().execute(new GetOrder('order-2'))).resolves.toBeUndefined();
  });
});
