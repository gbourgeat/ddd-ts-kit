/** A table the contract creates, as a member declares it to its read model table: a field is named after its column. */
export interface ReadModelTableShape {
  readonly table: string;
  /** The column of the key the store writes and finds by. */
  readonly key: string;
  /** The fields of the row besides the key: the columns a trace holds NULL in. */
  readonly fields: readonly string[];
  /** For a read model of tenant data: the column that holds the tenant. */
  readonly tenant?: string;
  /** The columns of the stamp, when the definition names them otherwise (`renamedStamps`). */
  readonly stamps?: {
    readonly lastEventId: string;
    readonly lastEventAt: string;
    readonly lastEventVersion: string;
    readonly deleted: string;
  };
  /** The fields the definition declares NOT NULL, whatever the database holds (`definition`). */
  readonly required?: readonly string[];
}
