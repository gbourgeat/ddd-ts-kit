import type { Kind } from './kind';
import { SHARED_WRITES } from './shared-writes';

/** One kind as `generate --help --json` lists it. */
export interface KindHelp {
  readonly name: string;
  readonly aliases: readonly string[];
  /** What follows `ddd-ts-kit generate`. */
  readonly usage: string;
  readonly summary: string;
  readonly writesShared: boolean;
  /** The shared files it writes; empty when it writes none. */
  readonly shared: readonly string[];
  /** When it writes them; null when it always does, or never. */
  readonly sharedWhen: string | null;
}

/** Every kind with what it takes and whether it stays inside its context. */
export function kindsHelp(kinds: readonly Kind[]): KindHelp[] {
  return kinds.map(({ name, aliases, usage, summary, writesShared }) => {
    const shared = writesShared ? SHARED_WRITES[name] : undefined;

    return {
      name,
      aliases,
      usage,
      summary,
      writesShared,
      shared: shared?.files ?? [],
      sharedWhen: shared?.when ?? null,
    };
  });
}
