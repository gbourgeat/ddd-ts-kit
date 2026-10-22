import type { Workspace } from '../workspace';
import { sectionOf } from './section-of';
import type { StoryPhase } from './story-phase';

/** The lines `## Origin` holds: where the story came from, and the versions it was built under. */
const ORIGIN_LINES = [
  { name: 'From:', pattern: /^\s*[-*]?\s*From:/m },
  { name: 'Built with:', pattern: /^\s*[-*]?\s*Built with:/m },
] as const;

/**
 * The origin of the story recorded in its specification: `## Origin` with a `From:` line (the
 * intent, the ticket or the incident it comes from) and a `Built with:` line (the versions of the
 * kit and the plugin, the base and its commit). Written at phase 1, read at the close: the pull
 * request carries it.
 */
export function originPhase(ws: Workspace, story: string, specification: string | undefined): StoryPhase {
  const origin = specification === undefined ? undefined : sectionOf(ws.read(specification) ?? '', 'Origin');
  const missing = ORIGIN_LINES.filter(({ pattern }) => origin === undefined || !pattern.test(origin));

  return {
    id: 'origin',
    title: 'origin recorded',
    met: origin !== undefined && missing.length === 0,
    detail:
      origin === undefined
        ? 'no `## Origin` in the specification'
        : missing.length === 0
          ? 'written'
          : `\`## Origin\` has no ${missing.map(({ name }) => `\`${name}\``).join(' nor ')} line`,
    next: `Write \`## Origin\` in docs/architecture/stories/${story}.md: \`- From:\` the intent, the ticket or the incident the story comes from, \`- Built with:\` the versions of the kit and the plugin, the base and its commit, \`- Policies in force:\` the skills loaded at phase 3.`,
    gate: 'close',
  };
}
