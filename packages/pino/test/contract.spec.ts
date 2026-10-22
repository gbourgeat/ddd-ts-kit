import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LogFields } from '@ddd-ts-kit/kernel';
import { loggerContract } from '@ddd-ts-kit/testing/contracts';
import { pino } from 'pino';
import { PinoLogger, correlationMixin, createPinoLogger } from '../src';
import { loggedLine } from './support/logged-line';
import { MemorySink } from './support/memory-sink';

declare module '@ddd-ts-kit/kernel' {
  interface LogFields {
    parcelId?: string;
  }
}

const runner = { describe, it, expect, beforeEach, afterEach };

loggerContract(runner, {
  name: 'PinoLogger of createPinoLogger',
  createLogger: (setup) => {
    const sink = new MemorySink();

    return {
      logger: createPinoLogger({ ...setup, service: 'shop', destination: sink.stream }),
      lines: () => sink.records().map(loggedLine),
    };
  },
});

loggerContract(runner, {
  name: 'PinoLogger around an instance of the project',
  createLogger: ({ level, fields, scrubMessages }) => {
    const sink = new MemorySink();

    return {
      logger: new PinoLogger(pino({ level, mixin: correlationMixin(fields) }, sink.stream), { scrubMessages }),
      lines: () =>
        sink
          .records()
          .map(({ msg, ...record }) => loggedLine({ ...record, level: levelName(record.level), message: msg })),
    };
  },
});

describe('PinoLogger and LogFields', () => {
  it('takes the keys a project declares by merging', () => {
    const sink = new MemorySink();

    createPinoLogger({ destination: sink.stream }).child({ parcelId: 'parcel-1' }).info('parcel handed over');

    expect(sink.records()).toMatchObject([{ parcelId: 'parcel-1' }]);
    expect(parcelOf({ parcelId: 'parcel-1' })).toBe('parcel-1');
  });
});

/** Compiles only while the fields of the adapter are the merged `LogFields` of the kernel. */
function parcelOf(fields: Parameters<PinoLogger['child']>[0]): string | undefined {
  const merged: LogFields = fields;

  return merged.parcelId;
}

function levelName(level: unknown): string | undefined {
  return typeof level === 'number' ? pino.levels.labels[level] : undefined;
}
