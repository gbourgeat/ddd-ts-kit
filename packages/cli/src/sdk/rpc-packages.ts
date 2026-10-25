import type { Rpc } from './rpc';

/**
 * What the entry of the procedures imports, by `stack.rpc`: the entry is named after it, `./orpc`
 * or `./trpc`, and these are the only dependencies of a client.
 */
export const RPC_PACKAGES: Readonly<Record<Exclude<Rpc, 'none'>, readonly string[]>> = {
  orpc: ['@orpc/client', '@orpc/contract'],
  trpc: ['@trpc/client', '@trpc/server'],
};
