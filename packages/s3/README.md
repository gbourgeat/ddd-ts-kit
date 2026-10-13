**English** · [Français](README.fr.md)

# @ddd-ts-kit/s3

The kernel `FileStorage` on any provider of the S3 protocol: AWS S3, MinIO, OVHcloud Object
Storage, Scaleway, Cloudflare R2, Garage. The content of a file streams to the bucket in parts,
never whole in memory and never in the database; the aggregate keeps the `StoredFile` that `put`
answers. Nothing in `domain/` or `application/` imports this package: handlers depend on the
`FileStorage` port, and the platform binds this adapter.

```
npm i @ddd-ts-kit/s3 @aws-sdk/client-s3 @aws-sdk/lib-storage @aws-sdk/s3-request-presigner
```

The three packages of the official AWS SDK v3 are optional peers, written against 3.1150.

## Composition root

```ts
import { S3FileStorage, s3ClientOf } from '@ddd-ts-kit/s3';

const files = new S3FileStorage({
  client: s3ClientOf({
    endpoint: config.storage.endpoint, // left out for AWS; http://localhost:9000 for MinIO
    region: config.storage.region, // 'auto' for R2
    accessKeyId: config.storage.accessKeyId,
    secretAccessKey: config.storage.secretAccessKey,
  }),
  bucket: config.storage.bucket, // created by the infrastructure code, never by the application
  prefix: 'scheduling/', // optional: several applications in one bucket
});
```

`s3ClientOf` sets path-style addressing when an endpoint is given (MinIO and most self-hosted
servers need it) and computes checksums only when an operation requires one: the default of the
SDK sends a checksum with every request, which several providers that are not AWS refuse, and
which would bind a signed upload link to an empty body. A client built by hand works too.

## What it does

| Port method | On the bucket |
|---|---|
| `put(key, stream, { mediaType, maxBytes })` | a multipart upload of `partSize` parts (8 MiB by default, one in memory at a time); the content is counted and hashed on its way, and refused with `FILE_TOO_LARGE` beyond `maxBytes`, which aborts the upload and leaves the previous object |
| `get`, `stat` | `GetObject` as a stream, `HeadObject`; `undefined` when the object does not exist, a rejection when the service cannot be reached |
| `delete` | `DeleteObject`, idempotent |
| `copy`, `move` | `CopyObject` done by the service (and `DeleteObject` for a move), up to 5 GiB per object |
| `list(prefix)` | `ListObjectsV2`, page after page |
| `signedDownloadUrl` | a presigned `GetObject` answered with `Content-Disposition: attachment`, with the file name when one is given |
| `signedUploadUrl` | a presigned `PutObject` whose signature covers the `content-type`: another media type is refused by the service |

The checksum (`sha256:<hex>`) is answered by `put`, computed while the content streams; the
bucket does not keep it, so `stat` does not answer one. A file uploaded through a signed link
is measured, checked and hashed by `FileStaging.confirm` of the kernel, which reads it back.

## Limits

- A signed upload link cannot cap the size of what is sent (only a presigned POST policy can):
  its `maxBytes` is not enforced by the service, and `FileStaging.confirm` measures the file
  against the cap of the grant the server kept and discards it beyond.
- Copy and move go through `CopyObject`, limited to 5 GiB per object by the protocol.
- Lifecycle rules, versioning, object lock and the encryption of the bucket are settings of the
  bucket, made by the infrastructure code of the deployment, not by this adapter.

## Tests

The contract of the port is held against a real server: `fileStorageContract` of
`@ddd-ts-kit/testing/contracts` (re-exported by `@ddd-ts-kit/s3/testing`) runs on MinIO in the
integration job of the pipeline, with `DDD_TS_KIT_TEST_S3_ENDPOINT` set; without it the specs
that need a server are skipped. The upstream MinIO project stopped publishing images in 2025:
the pipeline runs `pgsty/minio`, built from the same sources, pinned by digest
(`pipeline/github/scripts/start-minio.sh`).

```
docker run -d --name minio -p 127.0.0.1:9000:9000 -e MINIO_ROOT_USER=ddd-ts-kit -e MINIO_ROOT_PASSWORD=ddd-ts-kit-secret pgsty/minio:RELEASE.2026-08-04T00-00-00Z server /data
DDD_TS_KIT_TEST_S3_ENDPOINT=http://localhost:9000 npx vitest run packages/s3
```

## Another provider

Google Cloud Storage and Azure Blob Storage speak their own protocols. A connector for one of
them is a class extending `FileStorage` of the kernel that passes `fileStorageContract` against
the real service or its emulator (fake-gcs-server, Azurite): see
[docs/tools/file-storage.md](../../docs/tools/file-storage.md).
