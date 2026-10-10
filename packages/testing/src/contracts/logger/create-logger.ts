import type { Awaitable } from '../awaitable.js';
import type { LoggerContractSetup } from './logger-contract-setup.js';
import type { LoggerUnderContract } from './logger-under-contract.js';

/** A logger on a fresh, empty sink. */
export type CreateLogger = (setup: LoggerContractSetup) => Awaitable<LoggerUnderContract>;
