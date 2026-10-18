/** One step of a story, in the order a session takes them. */
export interface StoryPhase {
  readonly id: 'specification' | 'rows' | 'design' | 'acceptance' | 'built' | 'passing' | 'trunk' | 'report';
  readonly title: string;
  readonly met: boolean;
  /** What stands, or what is missing. */
  readonly detail: string;
  /** What to do while it is not met. */
  readonly next: string;
  /** The gate it belongs to: `build` opens the code of the story, `close` its pull request. */
  readonly gate: 'build' | 'close';
}
