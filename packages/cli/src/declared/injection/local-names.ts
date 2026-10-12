import type { TokenReference } from './token-reference.js';

/**
 * The names a generated file binds its imports under. A class keeps its own name; a second
 * class of the same name, exported by another module, is bound as `Name_2`, so that two ports
 * called alike in two contexts never collide.
 */
export class LocalNames {
  private readonly byOrigin = new Map<string, string>();

  private readonly taken = new Set<string>();

  constructor(private readonly specifierOf: (reference: TokenReference) => string) {}

  of(reference: TokenReference): string {
    const origin = `${this.specifierOf(reference)}#${reference.name}`;
    const known = this.byOrigin.get(origin);

    if (known !== undefined) {
      return known;
    }

    const local = this.free(reference.name);

    this.byOrigin.set(origin, local);
    this.taken.add(local);

    return local;
  }

  /** Every binding, grouped by the specifier it is imported from. */
  bySpecifier(): Map<string, string[]> {
    const grouped = new Map<string, string[]>();

    for (const [origin, local] of this.byOrigin) {
      const [specifier = '', name = ''] = origin.split('#');

      grouped.set(specifier, [...(grouped.get(specifier) ?? []), name === local ? name : `${name} as ${local}`]);
    }

    return grouped;
  }

  private free(name: string): string {
    let local = name;

    for (let rank = 2; this.taken.has(local); rank += 1) {
      local = `${name}_${rank}`;
    }

    return local;
  }
}
