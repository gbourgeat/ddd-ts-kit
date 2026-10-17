/** One change between two versions of a file: `oldCount` lines from `oldStart` replaced by `newCount` lines from `newStart`. */
export interface Hunk {
  readonly oldStart: number;
  readonly oldCount: number;
  readonly newStart: number;
  readonly newCount: number;
}
