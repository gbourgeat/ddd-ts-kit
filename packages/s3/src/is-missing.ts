import { S3ServiceException } from '@aws-sdk/client-s3';

/** Whether the service answered that the object does not exist: `NoSuchKey` on a read, `NotFound` on a head. */
export function isMissing(error: unknown): boolean {
  return (
    error instanceof S3ServiceException &&
    (error.name === 'NoSuchKey' || error.name === 'NotFound' || error.$metadata.httpStatusCode === 404)
  );
}
