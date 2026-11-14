import type { Config } from '../../../config';
import { inDialect } from '../../../package-manager/in-dialect';
import { stackVars } from '../../../stack/stack-vars';
import { renderTemplate } from '../../../templating';
import type { Workspace } from '../../../workspace';
import { entryOf } from './entry-of';
import { placesOf } from './places-of';
import { tablesFileOf } from './tables-file-of';
import { workspaceSources } from './workspace-sources';

/** A line of the index, numbered from one, as written. */
interface IndexLine {
  readonly line: number;
  readonly text: string;
}

/** A line the kit did not write, and whether it stands in one of its regions. */
export interface ForeignLine extends IndexLine {
  readonly inRegion: boolean;
}

/** The template `init` writes the schema index of a TypeORM project from. */
const TEMPLATE = 'init/platform/database/schema.typeorm.ts.tpl';

const REGIONS = ['imports', 'schemas'] as const;

/** One import by name as the kit writes it in its region, on one line or several, the statement ending its line. */
const KIT_IMPORT = /import \{([^}]*)\} from '([^']+)';(?=\n|$)/y;

const IMPORTED_NAME = /^[\w$]+(?:\s+as\s+[\w$]+)?$/;

/** The lines of the index outside the regions of the kit, and the lines of each region. */
interface Parts {
  readonly outside: IndexLine[];
  readonly imports: IndexLine[];
  readonly schemas: IndexLine[];
}

/**
 * The first line of a TypeORM schema index the kit did not write, if any, the lowest of the index wherever it stands. Outside its regions the
 * index holds the text the template writes for the flags and the package manager of the project, whitespace aside;
 * in `// ddd-ts-kit:imports` imports by name of a tables file of a context or of a package of the
 * kit, as the kit writes them; in `// ddd-ts-kit:schemas` bare names, each followed by a comma.
 * Anything else, a comment included, is a line of the team: what a rename could make read another entity.
 */
export function lineTheKitDidNotWrite(ws: Workspace, config: Config, index: string): ForeignLine | undefined {
  const parts = partsOf(index);
  // As `init` writes it: rendered for the flags of the project, its commands in the dialect of its package manager.
  const template = partsOf(inDialect(renderTemplate(TEMPLATE, stackVars(config)), config.stack.packageManager));
  const outside = outsideNotWritten(parts.outside, template.outside);

  const inRegions = [
    importNotWritten(ws, config, parts.imports),
    parts.schemas.find(({ text }) => text.trim() !== '' && entryOf(text) === undefined),
  ];

  const found = [
    ...(outside === undefined ? [] : [{ ...outside, inRegion: false }]),
    ...inRegions.flatMap((line) => (line === undefined ? [] : [{ ...line, inRegion: true }])),
  ];

  return found.sort((one, other) => one.line - other.line)[0];
}

/** The lines of a text, sorted into the part outside the regions and the two regions, a region counted only when it closes. */
function partsOf(text: string): Parts {
  const lines = text.split('\n').map((line, at) => ({ line: at + 1, text: line }));
  const parts: Parts = { outside: [], imports: [], schemas: [] };
  let at = 0;

  while (at < lines.length) {
    const opening = lines[at] ?? { line: at + 1, text: '' };
    const region = REGIONS.find((name) => opening.text.trim() === `// ddd-ts-kit:${name}`);
    const closing = region === undefined ? -1 : closingOf(lines, { region, from: at + 1 });

    parts.outside.push(opening);

    if (region !== undefined && closing > at) {
      parts[region].push(...lines.slice(at + 1, closing));
      parts.outside.push(lines[closing] ?? opening);
      at = closing;
    }

    at += 1;
  }

  return parts;
}

function closingOf(lines: readonly IndexLine[], { region, from }: { region: string; from: number }): number {
  return lines.findIndex((line, at) => at >= from && line.text.trim() === `// /ddd-ts-kit:${region}`);
}

/** The first line outside the regions that is not the next line of the template, whitespace aside and blank lines left out. */
function outsideNotWritten(index: readonly IndexLine[], template: readonly IndexLine[]): IndexLine | undefined {
  const normalised = (lines: readonly IndexLine[]): IndexLine[] =>
    lines.map(({ line, text }) => ({ line, text: text.trim().replace(/\s+/g, ' ') })).filter(({ text }) => text !== '');

  const written = normalised(template);
  const held = normalised(index);
  const differing = held.findIndex(({ text }, at) => text !== written[at]?.text);

  if (differing >= 0) {
    return index.find(({ line }) => line === held[differing]?.line);
  }

  // Every line held is the template's, and the template writes more: the index ends where a line of the kit is missing.
  return held.length < written.length ? index.findLast(({ text }) => text.trim() !== '') : undefined;
}

/** The first line of the region of the imports that does not begin an import the kit writes there. */
function importNotWritten(ws: Workspace, config: Config, region: readonly IndexLine[]): IndexLine | undefined {
  const text = region.map((line) => line.text).join('\n');
  let at = 0;

  while (at < text.length) {
    const start = text.slice(at).search(/\S/);

    if (start < 0) {
      return undefined;
    }

    at += start;
    KIT_IMPORT.lastIndex = at;

    const found = KIT_IMPORT.exec(text);

    if (found === null || !isKitImport(ws, config, { clause: found[1] ?? '', source: found[2] ?? '' })) {
      return region[text.slice(0, at).split('\n').length - 1];
    }

    at += found[0].length;
  }

  return undefined;
}

/** Whether an import names entities only, from a tables file of a context or a package of the kit. */
function isKitImport(ws: Workspace, config: Config, { clause, source }: { clause: string; source: string }): boolean {
  const names = clause.split(',').map((part) => part.trim());
  const listed = names.at(-1) === '' ? names.slice(0, -1) : names;

  return (
    listed.length > 0 &&
    listed.every((name) => IMPORTED_NAME.test(name)) &&
    (source.startsWith('@ddd-ts-kit/') || isTablesFile(ws, config, source))
  );
}

/** Whether a module is the tables file of a context, at a place the kit writes one: whatever the file holds, the kit wrote its import. */
function isTablesFile(ws: Workspace, config: Config, source: string): boolean {
  const resolved = workspaceSources(ws, config).resolve(`${config.platformDir}/database/schema.ts`, source);

  return (
    resolved.kind === 'file' &&
    Object.keys(config.contexts).some(
      (context) =>
        tablesFileOf(ws, config, context) === resolved.path || placesOf(config, context).includes(resolved.path),
    )
  );
}
