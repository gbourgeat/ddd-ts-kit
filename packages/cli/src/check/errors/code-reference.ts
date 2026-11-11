/** A code named by a member of a code list, `SchedulingCodes.SlotTaken`: the list, the key, and where it is written. */
export interface CodeReference {
  readonly list: string;
  readonly key: string;
  readonly start: number;
}
