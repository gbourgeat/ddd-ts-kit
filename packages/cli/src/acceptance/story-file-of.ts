import type { Workspace } from '../workspace';

/** Where the specification of each story lives: its statement and its acceptance criteria. */
export const STORIES_DIR = 'docs/architecture/stories';

/** The specification of a story, `docs/architecture/stories/US5.md`, found whatever the case of its name; undefined when it has none. */
export function storyFileOf(ws: Workspace, story: string): string | undefined {
  const name = ws.list(STORIES_DIR).find((file) => file.toLowerCase() === `${story.toLowerCase()}.md`);

  return name === undefined ? undefined : `${STORIES_DIR}/${name}`;
}
