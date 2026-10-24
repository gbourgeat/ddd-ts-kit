import { scan } from '../check/scan/scan';
import { callArguments } from '../check/text/call-arguments';
import { escapeRegExp } from '../check/text/escape-reg-exp';
import type { ListPart } from '../check/text/list-part';
import { type ContextTree, roleFilesOf } from '../model-modules';
import type { Workspace } from '../workspace';
import { type DeclaredTable, declaredTableOf } from './declared-table-of';
import { objectProperties } from './object-properties';
import type { PersonalTableFacts } from './personal-table-facts';

const FOLDER = 'infrastructure/persistence';
const SUFFIX = '.personal-fields.ts';
const CALL = /(?<![\w$.])personalFields\s*(?:<[^>()]*>)?\s*\(/g;
const QUOTED = /'([^']*)'|"([^"]*)"/g;

type Declared = Omit<PersonalTableFacts, 'file'>;

/**
 * The personal data a context keeps, one entry per `personalFields` call of its
 * `infrastructure/persistence/*.personal-fields.ts` files: the declaration `generate repository
 * --personal` writes, or one written by hand in that file. The table is read from the declaration
 * (`{ table: 'customers' }`) or from the persistence file that defines the table it names
 * (a Drizzle table, a TypeORM entity schema).
 */
export function readPersonalData(ws: Workspace, tree: ContextTree): PersonalTableFacts[] {
  const persistence = roleFilesOf(ws, tree, FOLDER).filter(({ name }) => name.endsWith('.ts'));
  const sources = persistence.map(({ path }) => ws.read(path) ?? '').join('\n');

  return persistence
    .filter(({ name }) => name.endsWith(SUFFIX))
    .flatMap(({ path }) =>
      declarationsIn(ws.read(path) ?? '', sources).map((declared) => ({ file: path, ...declared })),
    );
}

function declarationsIn(text: string, sources: string): Declared[] {
  const { code } = scan(text);

  return [...code.matchAll(CALL)].flatMap((call) => {
    const [table, options] = callArguments(code, call.index + call[0].length - 1);
    const open = options === undefined ? -1 : objectOpening({ code, text }, options);

    if (table === undefined || open === -1) {
      return [];
    }

    const written = text.slice(table.start, table.start + table.code.length).trim();

    return [declaredIn({ code, text }, open, declaredTableOf(written, text, sources))];
  });
}

interface Source {
  readonly code: string;
  readonly text: string;
}

function declaredIn(source: Source, open: number, table: DeclaredTable): Declared {
  const properties = objectProperties(source.code, source.text, open);

  const written = (name: string): string => {
    const value = properties.get(name);

    return value === undefined ? '' : source.text.slice(value.start, value.end).trim();
  };

  const columns = (name: string): string[] => quotedIn(written(name)).map((column) => table.column(column));
  const retention = retentionOf(written('retention'), table);

  return {
    table: table.name,
    subject: columns('subject')[0] ?? '',
    fields: columns('fields'),
    files: columns('files'),
    erasure: quotedIn(written('erasure'))[0] ?? '',
    ...(retention === undefined ? {} : { retention }),
  };
}

/** The brace of the options: written in the call, or the object of the constant the call names. */
function objectOpening(source: Source, argument: ListPart): number {
  const written = argument.code.trim();

  if (written.startsWith('{')) {
    return argument.start + argument.code.indexOf('{');
  }

  const constant = new RegExp(String.raw`\bconst\s+${escapeRegExp(written)}\b[^=]*=\s*\{`).exec(source.code);

  return constant === null ? -1 : constant.index + constant[0].length - 1;
}

function quotedIn(written: string): string[] {
  return [...written.matchAll(QUOTED)].map((match) => match[1] ?? match[2] ?? '');
}

/** `{ after: 'ends_at', months: 36 }` as `36 months after ends_at`. */
function retentionOf(written: string, table: DeclaredTable): string | undefined {
  const after = /\bafter:\s*['"]([^'"]+)['"]/.exec(written)?.[1];
  const period = /\b(days|months|years):\s*([\d_]+)/.exec(written);

  if (after === undefined || period === null) {
    return undefined;
  }

  const amount = Number((period[2] ?? '').replaceAll('_', ''));
  const unit = amount === 1 ? (period[1] ?? '').slice(0, -1) : (period[1] ?? '');

  return `${String(amount)} ${unit} after ${table.column(after)}`;
}
