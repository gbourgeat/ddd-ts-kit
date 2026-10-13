import type { Deviation } from '../../config/index.js';
import { CliError } from '../../cli-error.js';
import { toName } from '../../naming/index.js';
import { renderTemplate } from '../../templating/index.js';
import type { Workspace } from '../../workspace/index.js';
import { ADR_DIRECTORY } from '../../check/governance/adr-directory.js';
import { nextAdrNumber } from './next-adr-number.js';

export interface AdrRequest {
  readonly title: string;
  /** What the decision relaxes, as the key the config names it by, and why. */
  readonly deviation?: Pick<Deviation, 'what' | 'reason'>;
}

/** Writes the record under the next free number and answers that number. */
export function writeAdr(ws: Workspace, request: AdrRequest): string {
  const slug = toName(request.title).kebab;

  if (slug === '') {
    throw new CliError(
      'A decision record needs a title.',
      'Pass it as the first argument, for example: ddd-ts-kit generate adr "Read the catalog without a gateway".',
    );
  }

  const number = nextAdrNumber(ws);
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
