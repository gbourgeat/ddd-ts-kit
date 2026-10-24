import { scan } from '../check/scan/scan';
import { callArguments } from '../check/text/call-arguments';
import { escapeRegExp } from '../check/text/escape-reg-exp';
import type { ListPart } from '../check/text/list-part';
import { type DeclaredTable, declaredTableOf } from './declared-table-of';
import { objectProperties } from './object-properties';
import type { PersonalTableFacts } from './personal-table-facts';

const CALL = /(?<![\w$.])personalFields\s*(?:<[^>()]*>)?\s*\(/g;
const QUOTED = /'([^']*)'|"([^"]*)"/g;

/** One `personalFields` call of a file, and where it starts in the text. */
export type PersonalDeclaration = Omit<PersonalTableFacts, 'file'> & { readonly offset: number };

type Declared = Omit<PersonalDeclaration, 'offset'>;

/**
 * The `personalFields` calls of the text of a file, read with the scanner of the checker: a call
 * in a comment is not one, a call whose options cannot be read is left out. `sources` holds the
 * persistence files of the context, where a Drizzle table or a TypeORM entity schema the call
 * names is defined: its properties are then named as the database names them.
 */
export function personalDeclarationsIn(text: string, sources: string): PersonalDeclaration[] {
  const { code } = scan(text);

  return [...code.matchAll(CALL)].flatMap((call) => {
    const [table, options] = callArguments(code, call.index + call[0].length - 1);
    const open = options === undefined ? -1 : objectOpening({ code, text }, options);

    if (table === undefined || open === -1) {
      return [];
    }

    const written = text.slice(table.start, table.start + table.code.length).trim();

    return [{ ...declaredIn({ code, text }, open, declaredTableOf(written, text, sources)), offset: call.index }];
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
