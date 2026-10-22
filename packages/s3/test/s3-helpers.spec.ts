import { NoSuchKey, NotFound, S3ServiceException } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { BucketKeys } from '../src/bucket-keys';
import { isMissing } from '../src/is-missing';
import { s3ClientOf } from '../src/s3-client-of';

const METADATA = { $metadata: {} };

describe('the helpers of the S3 connector, without a server', () => {
  it('turns the keys of the port into keys under the prefix of the bucket, and back', () => {
    const keys = new BucketKeys('app/');

    expect([keys.of('reports/march.pdf'), keys.under('reports/'), keys.back('app/reports/march.pdf')]).toEqual([
      'app/reports/march.pdf',
      'app/reports/',
      'reports/march.pdf',
    ]);
  });

  it('reads an absent object from what the service answers, and nothing else', () => {
    const forbidden = new S3ServiceException({
      name: 'AccessDenied',
      $fault: 'client',
      $metadata: { httpStatusCode: 403 },
    });

    const gone = new S3ServiceException({ name: 'Gone', $fault: 'client', $metadata: { httpStatusCode: 404 } });

    expect(
      [
        new NoSuchKey({ message: 'no such key', ...METADATA }),
        new NotFound({ message: 'not found', ...METADATA }),
        gone,
      ].map(isMissing),
    ).toEqual([true, true, true]);

    expect([forbidden, new Error('NoSuchKey')].map(isMissing)).toEqual([false, false]);
  });

  it('addresses buckets by path for an endpoint of its own, unless told otherwise', async () => {
    const settings = { region: 'us-east-1', accessKeyId: 'key', secretAccessKey: 'secret' };
    const minio = s3ClientOf({ ...settings, endpoint: 'http://127.0.0.1:9000' });
    const hosted = s3ClientOf({ ...settings, endpoint: 'https://s3.example.net', forcePathStyle: false });

    expect([
      minio.config.forcePathStyle,
      hosted.config.forcePathStyle,
      s3ClientOf(settings).config.forcePathStyle,
    ]).toEqual([true, false, false]);
  });
});
