/** `build`: the code of the story may start; `close`: the story may go to its pull request. */
export type StoryGate = 'build' | 'close';

export const STORY_GATES: readonly StoryGate[] = ['build', 'close'];
