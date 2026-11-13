import type { SourceFile } from '../check/model/source-file';
import { resolveImport } from '../check/project/resolve-import';
import { escapeRegExp } from '../check/text/escape-reg-exp';
import type { Config } from '../config';
import type { DeclaredClass } from './declared-class';

const REEXPORT = /(?<![\w$.])export\s+(?:type\s+)?(?:\*|\{([^}]*)\})\s*from\s*(?=['"`])/g;

/** A re-export of a file: the file it leads to, and the names it gives by the names it takes, none for `export *`. */
interface Reexport {
  readonly target: string;
  readonly names: Map<string, string> | undefined;
}

const DEFAULT_CLASS = /(?<![\w$.])export\s+default\s+(?:abstract\s+)?$/;

/**
 * The classes the sources declare at the level of a module, several in one file included, read
 * once and found by name: the tests are not read, nor a class declared in a function or in a
 * `namespace` block. What is asked of them several times (the names a class extends, what a file
 * re-exports) is worked out once.
 */
export class DeclaredClasses {
  readonly all: readonly DeclaredClass[];

  private readonly byName = new Map<string, DeclaredClass[]>();
  private readonly sources = new Map<string, SourceFile>();
  private readonly lineages = new Map<string, readonly string[]>();
  private readonly reexports = new Map<string, readonly Reexport[]>();

  constructor(
    private readonly config: Config,
    files: readonly SourceFile[],
  ) {
    for (const file of files) {
      this.sources.set(file.path, file);
    }

    this.all = files.filter((file) => !file.isTest).flatMap(declaredIn);

    for (const declared of this.all) {
      this.byName.set(declared.shape.name, [...(this.byName.get(declared.shape.name) ?? []), declared]);
    }
  }

  named(name: string): readonly DeclaredClass[] {
    return this.byName.get(name) ?? [];
  }

  source(file: string): SourceFile | undefined {
    return this.sources.get(file);
  }

  /** The class a file exports as its default and not by its name, when it declares one. */
  defaultOf(file: string): DeclaredClass | undefined {
    return this.all.find((declared) => declared.file === file && declared.isDefaultOnly);
  }

  /** The names a class is read under: its own, then those of the classes it extends, however far. */
  lineage(name: string): readonly string[] {
    const known = this.lineages.get(name);

    if (known !== undefined) {
      return known;
    }

    const names = new Set<string>();
    const pending = [name];

    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      if (!names.has(next)) {
        names.add(next);
        pending.push(...this.named(next).flatMap(({ shape }) => shape.superclass ?? []));
      }
    }

    const lineage = [...names];

    this.lineages.set(name, lineage);

    return lineage;
  }

  /**
   * The class a name imported from a file leads to: the one that file declares under it (its
   * default export for `default`), or, one level further, the one a re-export of that file
   * names, `export { A as B } from` read as `A` and `export * from` under the same name.
   */
  behind(file: string, name: string): DeclaredClass | undefined {
    if (name === 'default') {
      return this.defaultOf(file);
    }

    const declared = this.named(name).find((candidate) => candidate.file === file);

    if (declared !== undefined) {
      return declared;
    }

    const [through] = this.reexportsOf(file).flatMap(({ target, names }) => {
      const original = names === undefined ? name : names.get(name);

      return original === undefined ? [] : this.named(original).filter((candidate) => candidate.file === target);
    });

    return through;
  }

  private reexportsOf(file: string): readonly Reexport[] {
    const known = this.reexports.get(file);

    if (known !== undefined) {
      return known;
    }

    const source = this.source(file);
    const found = source === undefined ? [] : reexportsIn(this.config, source);

    this.reexports.set(file, found);

    return found;
  }
}

/** The statements `export .. from` of a file that lead to a file of the project. */
function reexportsIn(config: Config, { path, scan }: SourceFile): Reexport[] {
  return [...scan.code.matchAll(REEXPORT)].flatMap((match) => {
    const end = match.index + match[0].length;
    const specifier = scan.strings.find(({ start }) => start === end)?.value ?? '';
    const target = resolveImport(config, path, specifier);

    return target.kind === 'file' ? [{ target: target.path, names: namesOf(match[1]) }] : [];
  });
}

/** What the braces of a re-export bind, the name it gives by the name it takes; none for `export *`. */
function namesOf(braces: string | undefined): Map<string, string> | undefined {
  if (braces === undefined) {
    return undefined;
  }

  const bindings = braces.split(',').map((binding) =>
    binding
      .trim()
      .replace(/^type\s+/, '')
      .split(/\s+as\s+/),
  );

  return new Map(bindings.flatMap(([original = '', given = original]) => (original === '' ? [] : [[given, original]])));
}

function declaredIn(file: SourceFile): DeclaredClass[] {
  const { code } = file.scan;

  return file.structure.classes
    .filter((shape) => shape.depth === 0)
    .map((shape) => ({
      file: file.path,
      context: file.location.area === 'context' ? file.location.context : undefined,
      shape,
      code: code.slice(shape.start, shape.end + 1),
      isDefaultOnly:
        DEFAULT_CLASS.test(code.slice(0, shape.start)) || (!shape.isExported && isDefault(code, shape.name)),
    }));
}

/** `export default <Name>` or `export { <Name> as default }`, written apart from the class. */
function isDefault(code: string, name: string): boolean {
  const written = escapeRegExp(name);

  return new RegExp(`(?<![\\w$.])(?:export\\s+default\\s+${written}|${written}\\s+as\\s+default)(?![\\w$])`).test(code);
}
