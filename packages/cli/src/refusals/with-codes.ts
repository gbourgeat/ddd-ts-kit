import { CliError } from '../cli-error';
import { toName } from '../naming';

/** One entry of `domain/errors/codes.ts`: the name of a refusal class and the code it sets. */
export interface CodeEntry {
  readonly key: string;
  readonly code: string;
}

const ENTRY = /^\s*([A-Za-z_$][\w$]*)\s*:\s*(['"])([^'"]*)\2/gm;

/**
 * The closed list of the codes of a context with these entries, appended in order to the ones
 * it has, or a new list. The list answers what the classes read: `readonly code = <Ctx>Codes.<Class>`.
 */
export function withCodes(source: string | undefined, context: string, entries: readonly CodeEntry[]): string {
  const list = `${toName(context).pascal}Codes`;
  const text = source ?? emptyList(list, toName(context).pascal);
  const { opened, closed } = boundsOf(text, list, context);
  const known = new Map([...text.slice(opened, closed).matchAll(ENTRY)].map((m) => [m[1] ?? '', m[3] ?? '']));

  refuseOtherCodes(known, entries, list);

  const added = entries.filter(
    (entry, index) => !known.has(entry.key) && entries.findIndex((other) => other.key === entry.key) === index,
  );

  const before = text.slice(0, closed).trimEnd();
  const lines = added.map((entry) => `  ${entry.key}: '${entry.code}',\n`).join('');
  const comma = before.endsWith('{') || before.endsWith(',') || added.length === 0 ? '' : ',';

  return `${before}${comma}\n${lines}${text.slice(closed)}`;
}

/** Where the object of the list opens, and where its closing `} as const` stands. */
function boundsOf(text: string, list: string, context: string): { opened: number; closed: number } {
  const opened = new RegExp(`export const ${list}\\s*=\\s*\\{`).exec(text);
  const closed = opened === null ? -1 : text.indexOf('} as const', opened.index);

  if (opened === null || closed === -1) {
    throw new CliError(
      `The codes of ${context} are not written as \`export const ${list} = { .. } as const\`.`,
      'Write domain/errors/codes.ts in that form, then run `ddd-ts-kit error-factories --apply` again.',
    );
  }

  return { opened: opened.index, closed };
}

/** A class listed already keeps its code: the plan may not give it another. */
function refuseOtherCodes(known: ReadonlyMap<string, string>, entries: readonly CodeEntry[], list: string): void {
  for (const entry of entries) {
    const code = known.get(entry.key);

    if (code !== undefined && code !== entry.code) {
      throw new CliError(
        `${list}.${entry.key} is already the code ${code}, the plan gives it ${entry.code}.`,
        `Give the refusal of ${entry.code} another class in the plan.`,
      );
    }
  }
}

function emptyList(list: string, context: string): string {
  return [
    `export const ${list} = {} as const;`,
    '',
    `export type ${context}Code = (typeof ${list})[keyof typeof ${list}];`,
    '',
  ].join('\n');
}
