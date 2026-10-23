/** The document as a client may fetch it: a link that expires, and what it will find there. */
export interface GetAppointmentDocumentResult {
  readonly url: string;
  readonly expiresAt: Date;
  readonly name: string;
  readonly mediaType: string;
  readonly size: number;
}
