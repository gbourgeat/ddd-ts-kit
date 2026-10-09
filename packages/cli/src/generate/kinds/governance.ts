import { CONFIG_FILE, editConfigText, type Deviation } from '../../config.js';
import { CliError } from '../../errors.js';
import { toName } from '../../naming.js';
import { renderTemplate } from '../../templates.js';
import type { Workspace } from '../../workspace.js';
import type { Kind } from '../kind.js';

const ADR_DIRECTORY = 'docs/adr';

export const adrKind: Kind = {
  name: 'adr',
  aliases: [],
  usage: 'adr "<title>" [--deviation <what>] [--reason "<why>"]',
  summary: 'A decision record in docs/adr/; with --deviation, the entry of the config that points to it.',
  positionals: ['title'],
  run: ({ ws, args, flags }) => {
    const title = (args[0] ?? '').trim();
    const { deviation: what, reason = title } = flags;
    const number = writeAdr(ws, { title, ...(what === undefined ? {} : { deviation: { what, reason } }) });
    if (what !== undefined) declareDeviation(ws, { what, adr: number, reason });
  },
};

export interface AdrRequest {
  readonly title: string;
  /** What the decision relaxes, as the key the config names it by, and why. */
  readonly deviation?: Pick<Deviation, 'what' | 'reason'>;
}

/** Writes the record under the next free number and answers that number. */
export function writeAdr(ws: Workspace, request: AdrRequest): string {
  const slug = toName(request.title).kebab;
  if (slug === '') throw new CliError('A decision record needs a title.', 'Pass it as the first argument, for example: ddd-ts-kit generate adr "Read the catalog without a gateway".');
  const number = nextNumber(ws);
  const { deviation } = request;
  const adr = { number, title: request.title, date: today(), deviation: deviation !== undefined, what: deviation?.what ?? '', reason: deviation?.reason ?? '' };
  ws.create(`${ADR_DIRECTORY}/${number}-${slug}.md`, renderTemplate('adr/adr.md.tpl', { adr }));
  return number;
}

function nextNumber(ws: Workspace): string {
  const taken = ws.list(ADR_DIRECTORY).map((file) => Number(/^(\d+)-/.exec(file)?.[1] ?? '0'));
  return String(Math.max(0, ...taken) + 1).padStart(4, '0');
}

const today = (): string => new Date().toISOString().slice(0, 10);

function declareDeviation(ws: Workspace, deviation: Deviation): void {
  const text = ws.read(CONFIG_FILE);
  if (text === undefined) return;
  ws.update(CONFIG_FILE, editConfigText(text, (raw) => {
    const present: unknown[] = Array.isArray(raw['deviations']) ? raw['deviations'] : [];
    raw['deviations'] = [...present, deviation];
  }));
}
