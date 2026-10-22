import type { ClientDocument } from './client-document';

/** A client the project gets: its document, its package name and its directory. */
export interface PlannedClient {
  readonly document: ClientDocument;
  readonly packageName: string;
  readonly directory: string;
}
