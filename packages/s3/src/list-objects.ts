import { ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';
import type { ListedFile } from '@ddd-ts-kit/kernel';

/** Every object under the prefix, page after page, with the key of the bucket. */
export async function* listObjects(client: S3Client, bucket: string, prefix: string): AsyncIterable<ListedFile> {
  let token: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ...(token === undefined ? {} : { ContinuationToken: token }),
      }),
    );

    for (const object of page.Contents ?? []) {
      yield { key: object.Key ?? '', size: object.Size ?? 0, lastModified: object.LastModified ?? new Date(0) };
    }

    token = page.IsTruncated === true ? page.NextContinuationToken : undefined;
  } while (token !== undefined);
}
