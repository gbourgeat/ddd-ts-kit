import type { Deviation } from '../../config';
import { CliError } from '../../cli-error';
import { toName } from '../../naming';
import { renderTemplate } from '../../templating';
import type { Workspace } from '../../workspace';
import { ADR_DIRECTORY } from '../../check/governance/adr-directory';
import { adrNumber } from './adr-number';

export interface AdrRequest {
  readonly title: string;
  /** What the decision relaxes, as the key the config names it by, and why. */
  readonly deviation?: Pick<Deviation, 'what' | 'reason'>;
  /** The number asked with `--number`; by default, one after the highest in `docs/adr/`. */
  readonly number?: string;
}

/** Writes the record under the number asked, or the next free one, and answers that number. */
export function writeAdr(ws: Workspace, request: AdrRequest): string {
  const slug = toName(request.title).kebab;

  if (slug === '') {
    throw new CliError(
      'A decision record needs a title.',
      'Pass it as the first argument, for example: ddd-ts-kit generate adr "Read the catalog without a gateway".',
    );
  }

  const number = adrNumber(ws, request.number);
  const { deviation } = request;

  const adr = {
    number,
    title: request.title,
    date: today(),
    deviation: deviation !== undefined,
    what: deviation?.what ?? '',
    reason: deviation?.reason ?? '',
  };

  ws.create(`${ADR_DIRECTORY}/${number}-${slug}.md`, renderTemplate('adr/adr.md.tpl', { adr }));

  return number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
