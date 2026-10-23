import type { Io } from './io';

/** One command of the CLI: its arguments and where it prints, answering its exit code. */
export type Command = (args: readonly string[], io: Io) => number;
