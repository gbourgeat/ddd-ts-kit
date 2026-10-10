import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StdoutLogger } from '@ddd-ts-kit/aspects';
import { InMemoryLogger, LOG_LEVELS, type LogFields, type LogLevel } from '@ddd-ts-kit/kernel';
import { loggerContract, type LoggedLine } from '../src/contracts.js';

declare module '@ddd-ts-kit/kernel' {
  interface LogFields {
    parcelId?: string;
  }
}

const runner = { describe, it, expect, beforeEach, afterEach };

loggerContract(runner, {
  name: 'InMemoryLogger',
  createLogger: (setup) => {
    const logger = new InMemoryLogger({ ...setup, base: { service: 'shop' } });

    return { logger, lines: () => logger.entries };
  },
});

loggerContract(runner, {
  name: 'StdoutLogger',
  createLogger: (setup) => {
    const written: string[] = [];

    return {
      logger: new StdoutLogger({ ...setup, base: { service: 'shop' }, write: (line) => written.push(line) }),
      lines: () => written.map(lineOf),
    };
  },
});

describe('LogFields', () => {
  it('types the keys a project declares by merging, for every logger of the port', () => {
    const logger = new InMemoryLogger();

    logger.child({ parcelId: 'parcel-1' }).info('parcel handed over');

    expect(parcelOf(logger.entries[0]?.fields ?? {})).toBe('parcel-1');
  });
});

/** Compiles only while the merged declaration is seen: the index signature alone answers a `LogValue`. */
function parcelOf(fields: LogFields): string | undefined {
  return fields.parcelId;
}

function lineOf(json: string): LoggedLine {
  const { level, message, time: _time, ...fields } = JSON.parse(json) as Record<string, unknown>;

  return { level: levelOf(level), message: String(message), fields };
}

function levelOf(level: unknown): LogLevel {
  const known = LOG_LEVELS.find((one) => one === level);

  if (known === undefined) {
    throw new Error(`Not a level of the port: ${String(level)}`);
  }

  return known;
}
