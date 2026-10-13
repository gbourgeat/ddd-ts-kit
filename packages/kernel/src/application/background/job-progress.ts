/** How far a background job went: `{ done: 120, total: 450 }`. */
export interface JobProgress {
  readonly done: number;
  /** Absent while the job does not know it yet. */
  readonly total?: number;
}
