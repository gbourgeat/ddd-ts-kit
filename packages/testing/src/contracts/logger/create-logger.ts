import type { Awaitable } from '../awaitable';
import type { LoggerContractSetup } from './logger-contract-setup';
import type { LoggerUnderContract } from './logger-under-contract';

/** A logger on a fresh, empty sink. */
export type CreateLogger = (setup: LoggerContractSetup) => Awaitable<LoggerUnderContract>;
