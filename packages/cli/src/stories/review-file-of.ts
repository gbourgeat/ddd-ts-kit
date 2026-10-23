import type { Workspace } from '../workspace';

const REVIEWS_DIR = 'docs/architecture/reviews';

/** The design review of a story, `docs/architecture/reviews/US5.md`, whatever the case of its name; undefined when it has none. */
export function reviewFileOf(ws: Workspace, story: string): string | undefined {
  const name = ws.list(REVIEWS_DIR).find((file) => file.toLowerCase() === `${story.toLowerCase()}.md`);

  return name === undefined ? undefined : `${REVIEWS_DIR}/${name}`;
}
