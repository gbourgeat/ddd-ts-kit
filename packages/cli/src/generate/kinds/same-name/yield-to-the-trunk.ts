import { scan } from '../../../check/scan/scan';
import type { Config } from '../../../config';
import { toName } from '../../../naming/to-name';
import type { Workspace } from '../../../workspace';
import { indexExports } from './index-exports';
import type { Bound } from './symbol-of';
import { freeName } from './free-name';
import type { IndexReading } from './index-reading';
import { workspaceIndex } from './workspace-index';

/** A line that settles a name, as the kit writes it: one constant, alone on its line. */
const SETTLE_LINE = /^([ \t]*)export \{ (\w+)(?: as (\w+))? \} from '([^']+)';$/gm;

/**
 * A merge keeps the lines of both sides of the schema index of a Drizzle project. A line of the
 * branch may export, under a name, another table than the one the trunk exports under it: the
 * branch kept `orders` for its own context while the trunk stored `orders` in another, or gave its
 * table the name `shippingOrders` that a table of the trunk bears. Code of the trunk, and of every
 * branch cut from it, reads the table of the trunk under that name: the line of the branch moves
 * to a name nothing holds. The caller has read the index of the trunk with certainty, and puts the
 * index back if anything is lost. Answers a sentence per line moved.
 */
export function yieldToTheTrunk(ws: Workspace, config: Config, trunk: IndexReading): string[] {
  const index = `${config.platformDir}/database/schema.ts`;
  const held = ws.read(index) ?? '';
  const merged = workspaceIndex(ws, config);
  const ofTheTrunk = indexExports(trunk);
  const taken = [...indexExports(merged).keys()];
  const said: string[] = [];
  let settled = held;

  taken.push(...merged.stars.flatMap(({ symbols }) => symbols.map((symbol) => symbol.name)));

  // From the last line up, each written at its own place: a line a comment holds the same is never the one written.
  for (const { line, at, indent, constant, name, source } of settleLinesOf(held).reverse()) {
    const context = contextToRename(merged, ofTheTrunk, { constant, name, source });

    if (context !== undefined) {
      const free = freeName(toName(context), constant, (candidate) => taken.includes(candidate));

      taken.push(free);
      const written = `${indent}export { ${constant} as ${free} } from '${source}';`;

      settled = `${settled.slice(0, at)}${written}${settled.slice(at + line.length)}`;

      said.unshift(
        `${index} lists the name \`${constant}\` of ${context} as \`${free}\`, no longer as \`${name}\`: on the trunk \`${name}\` names another table, and the code of the trunk reads it under that name.`,
      );
    }
  }

  if (said.length > 0) {
    ws.update(index, settled);
  }

  return said;
}

/** The context whose table a line exports under a name the trunk gives to another table; undefined when the line may stay. */
function contextToRename(
  merged: IndexReading,
  ofTheTrunk: ReadonlyMap<string, Bound>,
  { constant, name, source }: { constant: string; name: string; source: string },
): string | undefined {
  const given = merged.given.find((one) => one.local === name && one.name === constant && one.source === source);
  const kept = ofTheTrunk.get(name)?.value;
  const isAnother = kept !== undefined && given?.value !== undefined && kept !== given.value;

  return isAnother ? merged.tables.find((tables) => tables.file === given.file)?.context : undefined;
}

/** A line that exports one constant by name: the constant, the name the index gives it, the module it comes from. */
interface SettleLine {
  readonly line: string;
  /** Where it stands in the index. */
  readonly at: number;
  readonly indent: string;
  readonly constant: string;
  readonly name: string;
  readonly source: string;
}

/** The lines of the index that export one constant by name, those a comment holds left out. */
function settleLinesOf(index: string): SettleLine[] {
  const { code } = scan(index);

  return [...index.matchAll(SETTLE_LINE)]
    .filter((found) => code.startsWith('export', found.index + (found[1] ?? '').length))
    .map((found) => {
      const [line, indent = '', constant = '', alias, source = ''] = found;

      return { line, at: found.index, indent, constant, name: alias ?? constant, source };
    });
}
