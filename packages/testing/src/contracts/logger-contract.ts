import type { ContractRunner } from './contract-runner.js';
import type { CreateLogger } from './logger/create-logger.js';
import { LoggerEntriesSuite } from './logger/logger-entries-suite.js';
import { LoggerShutdownSuite } from './logger/logger-shutdown-suite.js';

export interface LoggerContractOptions {
  readonly name: string;
  /** Called before each test, and by the tests that need another level or a scrubbing logger. */
  readonly createLogger: CreateLogger;
}

/**
 * What every implementation of the kernel `Logger` port guarantees, the in-memory one included:
 * entries, children, the fields of the work in progress and levels in a first suite; errors as
 * fields and the flush in a second.
 */
export function loggerContract(runner: ContractRunner, options: LoggerContractOptions): void {
  new LoggerEntriesSuite(runner, options.createLogger).describe(`${options.name} (logger contract)`);
  new LoggerShutdownSuite(runner, options.createLogger).describe(`${options.name} (logger contract: errors and flush)`);
}
