/**
 * Edits of the source of a controller written by the generator, which keep its shape: one more
 * name in an import, one more option of `@Controller`, a declaration before the class.
 */
export const controllerSource = {
  /** Adds `name` (`type Name` for a type) to the import of `module`, or a new import line after the last one. */
  withImport(source: string, name: string, module: string): string {
    const written = new RegExp(
      String.raw`import\s*(type\s*)?\{([^}]*)\}\s*from\s*'${module.replaceAll('/', '\\/')}';`,
    ).exec(source);

    if (written === null) {
      const lastImport = [...source.matchAll(/^import .*;$/gm)].at(-1);
      const at = lastImport === undefined ? 0 : lastImport.index + lastImport[0].length + 1;

      const typeOnly = name.startsWith('type ') ? 'type ' : '';

      return `${source.slice(0, at)}import ${typeOnly}{ ${name.replace(/^type\s+/, '')} } from '${module}';\n${source.slice(at)}`;
    }

    const names = (written[2] ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '');

    const bare = name.replace(/^type\s+/, '');

    if (names.some((part) => part.replace(/^type\s+/, '') === bare)) {
      return source;
    }

    const typeOnly = written[1] !== undefined;
    const added = typeOnly ? [...names, bare] : [...names, name];
    const values = added.filter((part) => !part.startsWith('type ')).sort();
    const types = added.filter((part) => part.startsWith('type ')).sort();

    return source.replace(
      written[0],
      `import ${typeOnly ? 'type ' : ''}{ ${[...values, ...types].join(', ')} } from '${module}';`,
    );
  },

  /** Adds an option line to `@Controller({ ... })`, after its `summary`, with its indentation. */
  withOption(source: string, line: string): string {
    const summary = /^(\s*)summary:.*$/m.exec(source);

    if (summary === null) {
      return source;
    }

    const end = summary.index + summary[0].length;

    return `${source.slice(0, end)}\n${summary[1] ?? ''}${line}${source.slice(end)}`;
  },

  /** Puts a declaration right before the decorator of the class. */
  beforeController(source: string, declaration: string): string {
    const at = source.indexOf('@Controller(');

    return `${source.slice(0, at)}${declaration}\n${source.slice(at)}`;
  },
};
