import { ACCEPTANCE_DIR } from './acceptance-file-of';

/** The lock of a story's acceptance, next to its spec. */
export function lockFileOf(story: string): string {
  return `${ACCEPTANCE_DIR}/${story.toLowerCase()}.acceptance.lock.json`;
}
