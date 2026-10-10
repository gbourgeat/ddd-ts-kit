/** What a row of a read model holds next to its fields: the event that last changed it. */
export interface ReadModelStamps {
  lastEventId: string;
  lastEventAt: Date;
  lastEventVersion: string | number | null;
  deleted: boolean;
}
