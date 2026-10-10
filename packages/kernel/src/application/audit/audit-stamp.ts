/** Who created and last changed a stored record, and when. Columns of the row, not of the aggregate. */
export interface AuditStamp {
  readonly createdAt: Date;
  readonly createdBy: string;
  readonly updatedAt: Date;
  readonly updatedBy: string;
}
