import type { Kind } from './kind';
import { SHARED_WRITES } from './shared-writes';
import { usageOf } from './usage-of';

/** One kind as `generate --help --json` lists it, and `generate <kind> --help --json` answers it. */
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
  /** True when it takes `--module`: it writes files the modules of the model of a context divide. */
  readonly writesInModules: boolean;
}

/** One kind, as `generate <kind> --help --json` answers it. */
export function kindHelp(kind: Kind): KindHelp {
  const { name, aliases, summary, writesShared, writesInModules } = kind;
  const shared = writesShared ? SHARED_WRITES[name] : undefined;

  return {
    name,
    aliases,
    usage: usageOf(kind),
    summary,
    writesShared,
    shared: shared?.files ?? [],
    sharedWhen: shared?.when ?? null,
    writesInModules,
  };
}
