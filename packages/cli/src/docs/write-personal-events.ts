import type { Config } from '../config';
import { CliError } from '../cli-error';
import { replaceRegion } from '../markers';
import { readTemplate } from '../templating';
import type { Workspace } from '../workspace';
import type { ContextFacts } from './context-facts';
import { personalEventLines } from './personal-event-lines';

/**
 * Writes the list of the events that carry personal data, in a project whose platform answers the
 * requests of a data subject through the outbox: `runErasure` reads it to reach the records of a
 * person, so a `personal` option that changes changes what an erasure reaches, and `docs --check`
 * reports a list left behind.
 */
export function writePersonalEvents(ws: Workspace, config: Config, contexts: readonly ContextFacts[]): void {
  if (config.stack.privacy !== 'on' || config.stack.events !== 'outbox') {
    return;
  }

  const file = `${config.platformDir}/privacy/personal-events.ts`;
  const existing = ws.read(file);

  const next = replaceRegion(
    existing ?? readTemplate('init/platform/privacy/personal-events.ts.tpl'),
    'personal-events',
    personalEventLines(contexts),
  );

  if (next === undefined) {
    throw new CliError(
      `${file} has no "ddd-ts-kit:personal-events" markers.`,
      'Put back `// ddd-ts-kit:personal-events` and `// /ddd-ts-kit:personal-events` inside the list: `ddd-ts-kit docs` writes what lies between them.',
    );
  }

  if (existing === undefined) {
    ws.create(file, next);
  } else {
    ws.update(file, next);
  }
}
