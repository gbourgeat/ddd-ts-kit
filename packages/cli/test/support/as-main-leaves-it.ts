import { git } from './git';
import { INDEX } from './index-invariant';

const REGIONS = ['imports', 'schemas'];

/**
 * The schema index as `merge-trunk` leaves it without any settle, to read before the merge: the
 * index of the branch, each region of the kit holding the lines of the branch, then the lines the
 * trunk added there. True of the sides whose regions import from different modules.
 */
export function asMainLeavesIt(root: string): string {
  const at = (revision: string): string => git(root, 'show', `${revision}:${INDEX}`);
  const base = at('base');
  const trunk = at('main');

  const regions = REGIONS.reduce((index, region) => {
    const ours = regionLines(index, region);

    const added = regionLines(trunk, region).filter(
      (line) => !regionLines(base, region).includes(line) && !ours.includes(line),
    );

    return index.replace(regionPattern(region), (_whole, opening: string, closing: string) =>
      [opening, ...ours, ...added, closing].join('\n'),
    );
  }, at('build/work'));

  return `${regions}${appendedTo(base, trunk)}`;
}

/** What the trunk wrote after the last line of the index of the base. */
function appendedTo(base: string, trunk: string): string {
  const last = base.trimEnd().split('\n').at(-1) ?? '';
  const lines = trunk.split('\n');

  return lines.slice(lines.lastIndexOf(last) + 1).join('\n');
}

function regionLines(index: string, region: string): string[] {
  const inner = regionPattern(region).exec(index)?.[0].split('\n').slice(1, -1) ?? [];

  return inner.filter((line) => line.trim() !== '');
}

function regionPattern(region: string): RegExp {
  return new RegExp(`([ \\t]*// ddd-ts-kit:${region})\\n[\\s\\S]*?\\n?([ \\t]*// /ddd-ts-kit:${region})`);
}
