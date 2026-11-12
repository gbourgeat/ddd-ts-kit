/** The trunk the migrations of a branch are ordered against. */
export interface TrunkToFollow {
  /** The ref, as the report and the commands of a fix name it. */
  readonly name: string;
  readonly commit: string;
  /** Whether the branch already holds that commit: what brings the order right differs. */
  readonly merged: boolean;
}
