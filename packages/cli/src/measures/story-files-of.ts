import { acceptanceFileOf } from '../acceptance/acceptance-file-of';
import { lockFileOf } from '../acceptance/lock-file-of';
import type { StoryFiles } from './story-files';

/** Where the files of a story live; the review file only when the project has it. */
export function storyFilesOf(story: string, file: string, review: string | undefined): StoryFiles {
  return {
    story,
    file,
    ...(review === undefined ? {} : { review }),
    lock: lockFileOf(story),
    acceptance: acceptanceFileOf(story),
  };
}
