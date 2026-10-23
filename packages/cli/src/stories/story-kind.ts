/** What a story is: a `story` builds rows behind locked acceptance scenarios; a `fix` builds behind locked regression specs. */
export type StoryKind = 'story' | 'fix';

export const STORY_KINDS: readonly StoryKind[] = ['story', 'fix'];
