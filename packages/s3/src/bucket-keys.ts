import { assertFileKey, isFileKey } from '@ddd-ts-kit/kernel';

/** Turns the keys of the port into the keys of the bucket and back, under the prefix of the connector. */
export class BucketKeys {
  constructor(private readonly prefix: string) {
    if (prefix !== '' && !(prefix.endsWith('/') && isFileKey(prefix.slice(0, -1)))) {
      throw new Error(`The prefix of an S3 file storage is a valid key ending with "/", not "${prefix}".`);
    }
  }

  of(key: string): string {
    return `${this.prefix}${assertFileKey(key)}`;
  }

  /** The prefix of the bucket a listing of the port reads. */
  under(prefix: string): string {
    return `${this.prefix}${prefix}`;
  }

  /** The key of the port of an object listed in the bucket. */
  back(objectKey: string): string {
    return objectKey.slice(this.prefix.length);
  }
}
