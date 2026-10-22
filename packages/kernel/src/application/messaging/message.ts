import type { Command } from './command';
import type { Query } from './query';

export type Message = Command<unknown> | Query<unknown>;
