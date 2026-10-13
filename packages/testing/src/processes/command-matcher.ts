import type { Command } from '@ddd-ts-kit/kernel';

type CommandClass = abstract new (...args: never[]) => Command<unknown>;

/** How an expected command is described: its class, or the properties that matter (a subset). */
export type CommandMatcher = CommandClass | { readonly [property: string]: unknown };
