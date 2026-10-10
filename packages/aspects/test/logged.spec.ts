import { describe, expect, it } from 'vitest';
import { InMemoryLogger } from '@ddd-ts-kit/kernel';
import { AspectRuntimeError, compose, logged } from '../src/index.js';
import { createAspectFakes, withAspectRuntime } from '../src/testing.js';
import { lasting } from './support/lasting.js';
import { PairNotQuoted } from './support/pair-not-quoted.js';
import { QuoteGateway } from './support/quote-gateway.js';
import { SECRETS } from './support/secrets.js';
import { Unreachable } from './support/unreachable.js';

describe('logged', () => {
  it('writes a start and a success entry with class, method, kind, context and duration', async () => {
    const fakes = createAspectFakes();

    const gateway = compose(logged(), lasting(fakes.clock, 40))(new QuoteGateway(), {
      kind: 'external',
      context: 'pricing',
    });

    await withAspectRuntime(fakes, () => gateway.quote('EUR-USD'));

    const subject = { class: 'QuoteGateway', method: 'quote', kind: 'external', context: 'pricing' };

    expect(fakes.logger.entries).toEqual([
      { level: 'debug', message: 'QuoteGateway.quote started', fields: subject },
      { level: 'info', message: 'QuoteGateway.quote succeeded', fields: { ...subject, durationMs: 40 } },
    ]);
  });

  it('writes a fault as an error with its class and code, and rethrows it untouched', async () => {
    const fakes = createAspectFakes();
    const fault = new Unreachable();
    const gateway = logged()(new QuoteGateway().failNext(fault));

    await expect(withAspectRuntime(fakes, () => gateway.quote('EUR-USD'))).rejects.toBe(fault);

    expect(fakes.logger.entries.at(-1)).toEqual({
      level: 'error',
      message: 'QuoteGateway.quote failed',
      fields: {
        class: 'QuoteGateway',
        method: 'quote',
        durationMs: 0,
        errorType: 'Unreachable',
        errorCode: 'ECONNRESET',
      },
    });
  });

  it('writes a business refusal as a warning with the code of the domain error', async () => {
    const fakes = createAspectFakes();
    const gateway = logged()(new QuoteGateway().failNext(new PairNotQuoted()));

    await expect(withAspectRuntime(fakes, () => gateway.quote('EUR-USD'))).rejects.toBeInstanceOf(PairNotQuoted);

    expect(fakes.logger.entries.at(-1)).toMatchObject({
      level: 'warn',
      fields: { errorType: 'PairNotQuoted', errorCode: 'PAIR_NOT_QUOTED' },
    });
  });

  it('builds no field for an entry its logger would not write', async () => {
    const fakes = createAspectFakes();
    const logger = new InMemoryLogger({ level: 'warn' });
    let read = 0;
    const fields = (): { region: string } => ({ region: `eu-${String((read += 1))}` });
    const gateway = logged({ logger, fields })(new QuoteGateway());

    await withAspectRuntime(fakes, () => gateway.quote('EUR-USD'));

    expect(read).toBe(0);

    gateway.failNext(new Unreachable());
    await expect(withAspectRuntime(fakes, () => gateway.quote('EUR-USD'))).rejects.toBeInstanceOf(Unreachable);

    expect(read).toBe(1);

    expect(logger.entries).toMatchObject([
      { level: 'error', message: 'QuoteGateway.quote failed', fields: { region: 'eu-1' } },
    ]);
  });

  it('never records arguments, results or error messages', async () => {
    const fakes = createAspectFakes();
    const gateway = logged()(new QuoteGateway());

    await withAspectRuntime(fakes, async () => {
      await gateway.quote('EUR-USD');

      await gateway
        .failNext(new Unreachable())
        .quote('EUR-USD')
        .catch(() => undefined);

      await gateway
        .failNext(new PairNotQuoted())
        .quote('EUR-USD')
        .catch(() => undefined);
    });

    expect(JSON.stringify(fakes.logger.entries)).not.toMatch(SECRETS);
  });
});

describe('logged, its options and what it survives', () => {
  it('takes its level, its fields and its logger from the options', async () => {
    const logger = new InMemoryLogger();
    let region = 'eu';
    const gateway = logged({ logger, level: 'debug', fields: () => ({ region }) })(new QuoteGateway());

    await gateway.quote('EUR-USD');
    region = 'us';
    await gateway.quote('EUR-USD');

    expect(logger.entries.map((entry) => [entry.level, entry.fields.region])).toEqual([
      ['debug', 'eu'],
      ['debug', 'eu'],
      ['debug', 'us'],
      ['debug', 'us'],
    ]);
  });

  it('does not let a failing logger change the outcome of the call', async () => {
    const broken = new InMemoryLogger();

    broken.info = () => {
      throw new Error('disk full');
    };

    broken.debug = broken.info;

    expect(await logged({ logger: broken })(new QuoteGateway()).quote('EUR-USD')).toMatchObject({ rate: 1.08 });
  });

  it('says which collaborator is missing when no runtime provides it', async () => {
    const gateway = logged()(new QuoteGateway());

    await expect(withAspectRuntime({}, () => gateway.quote('EUR-USD'))).rejects.toBeInstanceOf(AspectRuntimeError);

    await expect(withAspectRuntime({}, () => gateway.quote('EUR-USD'))).rejects.toThrow(
      /installAspectRuntime\(\{ logger \}\)/,
    );
  });
});
