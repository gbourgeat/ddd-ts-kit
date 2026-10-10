/** Where a page ended: enough to resume in either order, whatever the store. */
export interface CursorPosition {
  readonly occurredAt: Date;
  readonly chain: string;
  readonly sequence: number;
}
