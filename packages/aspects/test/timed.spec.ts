import { describe, expect, it } from 'vitest';
import { compose, timed } from '../src/index.js';
import { createAspectFakes, withAspectRuntime } from '../src/testing.js';
import { lasting } from './support/lasting.js';
import { PairNotQuoted } from './support/pair-not-quoted.js';
import { QuoteGateway } from './support/quote-gateway.js';
import { SECRETS } from './support/secrets.js';

describe('timed', () => {
  it('records the duration and counts the outcome, labelled by what was called', async () => {
    const fakes = createAspectFakes();

    const gateway = compose(timed(), lasting(fakes.clock, 25))(new QuoteGateway(), {
      kind: 'gateway',
      context: 'pricing',
    });

    await withAspectRuntime(fakes, () => gateway.quote('EUR-USD'));

    const labels = { class: 'QuoteGateway', method: 'quote', kind: 'gateway', context: 'pricing', outcome: 'success' };

    expect(fakes.metrics.samples).toEqual([
      { kind: 'histogram', name: 'dependency_call_duration_ms', value: 25, labels },
      { kind: 'counter', name: 'dependency_call_total', value: 1, labels },
    ]);
  });

  it('counts a failure with its error code and nothing else about it', async () => {
    const fakes = createAspectFakes();
    const gateway = timed({ name: 'quotes' })(new QuoteGateway().failNext(new PairNotQuoted(), new TypeError('x')));

    await withAspectRuntime(fakes, async () => {
      await gateway.quote('EUR-USD').catch(() => undefined);
      await gateway.quote('EUR-USD').catch(() => undefined);
    });

    expect(fakes.metrics.counterValue('quotes_total', { outcome: 'failure', error_code: 'PAIR_NOT_QUOTED' })).toBe(1);
    expect(fakes.metrics.counterValue('quotes_total', { outcome: 'failure' })).toBe(2);
    expect(fakes.metrics.histogramValues('quotes_duration_ms', { outcome: 'failure' })).toEqual([0, 0]);
    expect(JSON.stringify(fakes.metrics.samples)).not.toMatch(SECRETS);
  });
});
