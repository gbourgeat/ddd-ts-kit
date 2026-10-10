import type { Command } from './command.js';
import type { Query } from './query.js';

export type Message = Command<unknown> | Query<unknown>;
