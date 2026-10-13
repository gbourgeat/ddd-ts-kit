import type { FieldAccessEntry } from './field-access-entry.js';
import type { FieldRule } from './field-rule.js';

/** The restricted fields seen from one object: those it holds itself, and those further down, by the name that leads to them. */
export class FieldTree {
  private constructor(private readonly entries: readonly FieldAccessEntry[]) {}

  static of(entries: readonly FieldAccessEntry[]): FieldTree {
    return new FieldTree(entries);
  }

  isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /** The rules of the fields of this very object, by name. */
  own(): readonly (readonly [string, FieldRule])[] {
    return this.entries.flatMap(({ path, rule }) =>
      path.length === 1 && path[0] !== undefined ? [[path[0], rule]] : [],
    );
  }

  /** The names that lead to restricted fields further down. */
  branches(): readonly string[] {
    return [
      ...new Set(this.entries.flatMap(({ path }) => (path.length > 1 && path[0] !== undefined ? [path[0]] : []))),
    ];
  }

  /** The tree seen from the value under `name`, `*` for an item of a list. */
  below(name: string): FieldTree {
    return new FieldTree(
      this.entries.flatMap(({ path, rule }) =>
        path.length > 1 && path[0] === name ? [{ path: path.slice(1), rule }] : [],
      ),
    );
  }
}
