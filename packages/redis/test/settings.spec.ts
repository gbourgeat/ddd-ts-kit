import { describe, expect, it } from 'vitest';
import { settingsOf } from '../src/streams/options/settings-of';

describe('the settings of a bus', () => {
  it('keep a hook that throws from throwing out of the bus', () => {
    const settings = settingsOf({
      connection: 'redis://127.0.0.1:1',
      onFailure: () => {
        throw new Error('the metrics backend is down');
      },
      onDelivery: () => {
        throw new Error('the metrics backend is down');
      },
    });

    expect(() => {
      settings.onFailure({ kind: 'connection', code: 'ECONNREFUSED' });
    }).not.toThrow();

    expect(() => {
      settings.onDelivery({
        stream: 'events:ordering.order.placed',
        consumer: 'billing',
        attempt: 1,
        outcome: 'acknowledged',
      });
    }).not.toThrow();
  });
});
