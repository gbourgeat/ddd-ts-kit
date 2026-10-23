/** What the server holds and answers, shared by the store and the documents it is read through. */
export interface StoredObject {
  readonly body: Buffer;
  readonly contentType: string;
  readonly etag: string;
  readonly lastModified: Date;
}

export interface PendingUpload {
  readonly id: string;
  readonly key: string;
  readonly contentType: string;
  readonly parts: Map<number, StoredObject>;
}

export interface ObjectPage {
  readonly bucket: string;
  readonly prefix: string;
  readonly maxKeys: number;
  readonly token: string | undefined;
  readonly nextToken: string | undefined;
  readonly objects: readonly (readonly [string, StoredObject])[];
}

export interface CompletedPart {
  readonly number: number;
  readonly etag: string;
}
