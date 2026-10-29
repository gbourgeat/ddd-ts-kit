import { FLAG_NOTES } from './flag-notes';
import type { Note } from './note';
import { READING_NOTES } from './reading-notes';
import { TOOL_NOTES } from './tool-notes';
import { WORK_NOTES } from './work-notes';

/** What a line of the usage cannot say about a command or a flag, each note under the command whose help prints it, in the order of the reference. */
export const NOTES: readonly Note[] = [...TOOL_NOTES, ...READING_NOTES, ...WORK_NOTES, ...FLAG_NOTES];
