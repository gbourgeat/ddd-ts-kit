import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LogFields } from '@ddd-ts-kit/kernel';
import { loggerContract } from '@ddd-ts-kit/testing/contracts';
import winston from 'winston';
import { WinstonLogger, correlationFields, createWinstonLogger } from '../src';
import { loggedLine } from './support/logged-line';
import { MemorySink } from './support/memory-sink';
import { memoryTransport } from './support/memory-transport';

declare module '@ddd-ts-kit/kernel' {
  interface LogFields {
    parcelId?: string;
  }
}

const runner = { describe, it, expect, beforeEach, afterEach };

loggerContract(runner, {
  name: 'WinstonLogger of createWinstonLogger',
  createLogger: (setup) => {
    const sink = new MemorySink();

    return {
      logger: createWinstonLogger({ ...setup, service: 'shop', transports: [memoryTransport(sink)] }),
      lines: () => sink.records().map(loggedLine),
    };
  },
});

loggerContract(runner, {
  name: 'WinstonLogger around an instance of the project',
  createLogger: ({ level, fields, scrubMessages }) => {
    const sink = new MemorySink();

    const instance = winston.createLogger({
      level,
      format: winston.format.combine(correlationFields(fields), winston.format.json()),
      transports: [memoryTransport(sink)],
    });

    return { logger: new WinstonLogger(instance, { scrubMessages }), lines: () => sink.records().map(loggedLine) };
  },
});

describe('WinstonLogger and LogFields', () => {
  it('takes the keys a project declares by merging', () => {
    const sink = new MemorySink();

    createWinstonLogger({ transports: [memoryTransport(sink)] })
      .child({ parcelId: 'parcel-1' })
      .info('parcel handed over');

    expect(sink.records()).toMatchObject([{ parcelId: 'parcel-1' }]);
    expect(parcelOf({ parcelId: 'parcel-1' })).toBe('parcel-1');
  });
});

/** Compiles only while the fields of the adapter are the merged `LogFields` of the kernel. */
function parcelOf(fields: Parameters<WinstonLogger['child']>[0]): string | undefined {
  const merged: LogFields = fields;

  return merged.parcelId;
}
