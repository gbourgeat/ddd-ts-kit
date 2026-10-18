/** Where the acceptance scenarios of the stories live, at the project root next to `test/e2e/`. */
export const ACCEPTANCE_DIR = 'test/acceptance';

/** The acceptance spec of a story: `US5` is `test/acceptance/us5.acceptance.spec.ts`. */
export function acceptanceFileOf(story: string): string {
  return `${ACCEPTANCE_DIR}/${story.toLowerCase()}.acceptance.spec.ts`;
}
