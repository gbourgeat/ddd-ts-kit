import { scan } from '../../../check/scan/scan';
import { escapeRegExp } from '../../../check/text/escape-reg-exp';
import type { Config } from '../../../config';
import type { Workspace } from '../../../workspace';
import type { EntityOf } from './bound-by';
import { placesOf } from './places-of';
import { readTablesFile } from './read-tables-file';
import type { Sources } from './sources-of';
import { tablesFileOf } from './tables-file-of';
import { workspaceSources } from './workspace-sources';

/**
 * How the schema index names the entity an import binds: the file its specifier resolves to and the
 * name it imports there. The kit tells two entities apart only by the tables files that declare
 * them: an import counts as told apart only when it resolves to the tables file of a context that
 * declares the name itself, a constant built by `new` (`export const <name> = new ...`, or
 * declared so and exported under its name), a new object. A name that file
 * re-exports, renames or aliases, a module that resolves to no file, or a package is not.
 */
export function declaredEntityOf(ws: Workspace, config: Config): EntityOf {
  const sources = workspaceSources(ws, config);
  const index = `${config.platformDir}/database/schema.ts`;

  const tablesFiles = new Set(
    Object.keys(config.contexts).flatMap((context) => [
      tablesFileOf(ws, config, context),
      ...placesOf(config, context),
    ]),
  );

  return (source, name) => {
    const resolved = sources.resolve(index, source);

    if (resolved.kind !== 'file') {
      return { entity: `${source}#${name}`, told: false };
    }

    const { path } = resolved;

    return {
      entity: `${path}#${name}`,
      file: path,
      told: tablesFiles.has(path) && declares(sources, { file: path, name }),
    };
  };
}

/**
 * Whether a file declares a value of this name itself, as a new object, in the statement that
 * exports it: `export const <name> = new ...` at the top level, or a top-level
 * `const <name> = new ...` that a by-name `export { <name> }` lists under that same name. The
 * reader must see it declared there too, never taken from another module.
 */
function declares(sources: Sources, { file, name }: { file: string; name: string }): boolean {
  const isOwn = readTablesFile(sources, file).symbols.some(
    (symbol) => symbol.name === name && symbol.kind === 'value' && symbol.declaredHere,
  );

  return isOwn && declaresItself(scan(sources.read(file) ?? '').code, name);
}

function declaresItself(code: string, name: string): boolean {
  const escaped = escapeRegExp(name);
  const built = String.raw`const\s+${escaped}\s*(?::[^=]*)?=\s*new\s`;
  const statements = topLevelStatements(code);
  const isExported = statements.some((statement) => new RegExp(`^export\\s+${built}`).test(statement));
  const isDeclared = statements.some((statement) => new RegExp(`^${built}`).test(statement));

  return isExported || (isDeclared && statements.some((statement) => isListedByName(statement, name)));
}

/** Whether a statement is a list of names exported from this module, `export { ... }`, that holds the name as it is. */
function isListedByName(statement: string, name: string): boolean {
  const clause = /^export\s*\{([^{}]*)\}(?!\s*from)/.exec(statement)?.[1];
  const parts = (clause ?? '').split(',').map((part) => part.trim());

  return clause !== undefined && parts.some((part) => part.split(/\s+as\s+/).every((held) => held === name));
}

/**
 * The code of each statement at the top level of a module, where it starts: after a semicolon or
 * at the start of a line, outside any brace, bracket or parenthesis, so that a module written
 * without semicolons is read as one with them.
 */
function topLevelStatements(code: string): string[] {
  const starts = [0];
  let depth = 0;

  for (let at = 0; at < code.length; at += 1) {
    const char = code.charAt(at);

    depth += '([{'.includes(char) ? 1 : ')]}'.includes(char) ? -1 : 0;

    if (depth === 0 && (char === ';' || char === '\n')) {
      starts.push(at + 1);
    }
  }

  return starts.map((at) => code.slice(at).trimStart());
}
