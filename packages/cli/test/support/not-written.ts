const OPENING = /^[ \t]*\/\/ ddd-ts-kit:(imports|schemas)$/;

/**
 * The one sentence of a TypeORM settle in an index that holds a line the kit did not write, the
 * first such line being `line`, after the name of the index. Outside the regions of the kit, it
 * ends with how to write the index again from the template of this version.
 */
export function notWritten(index: string, line: string): string {
  const lines = index.split('\n');
  const at = lines.findIndex((held) => held.trim() === line.trim());
  const opened = lines.slice(0, at).findLastIndex((held) => OPENING.test(held));
  const region = OPENING.exec(lines[opened] ?? '')?.[1];

  const inRegion =
    region !== undefined && !lines.slice(opened, at).some((held) => held.trim() === `// /ddd-ts-kit:${region}`);

  const again = inRegion
    ? ''
    : '; run `npx ddd-ts-kit init --force` after a commit to write the index again from the template of this version: it settles the names then';

  return `the kit wrote nothing for the entities: the index holds a line the kit did not write (line ${at + 1}: \`${line.trim()}\`); import the entities of one name under two names by hand${again}.`;
}
