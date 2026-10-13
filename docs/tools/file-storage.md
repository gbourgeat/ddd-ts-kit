**English** · [Français](file-storage.fr.md)

# File storage connectors

**Summary.** Files live behind the `FileStorage` port of the kernel. The kit ships three
connectors held to one contract suite (`fileStorageContract` of `@ddd-ts-kit/testing/contracts`):
the memory of the process for the tests, a local directory for development, and an S3-compatible
bucket (`@ddd-ts-kit/s3`, on the official AWS SDK v3) for a deployment, which covers AWS S3,
MinIO, OVHcloud, Scaleway, Cloudflare R2 and Garage. Google Cloud Storage and Azure Blob
Storage are reached by writing an adapter that passes the same suite. Pick the S3 connector
for anything deployed; keep the directory for one developer's machine.

## The connectors

| | `InMemoryFileStorage` | `LocalFileStorage` | `S3FileStorage` (`@ddd-ts-kit/s3`) |
|---|---|---|---|
| For | the tests, the tools | development, one machine | every deployment |
| Where the content is | a map in the process | a directory, metadata in `.metadata/` | a bucket, under an optional prefix |
| Streaming | in, then held in memory | in and out, a write renamed into place | multipart upload of 8 MiB parts, one in memory; a stream out |
| Signed links | tokens answered by `signedFileRoutes` | tokens answered by `signedFileRoutes` | presigned by the service |
| Several instances | no | no | yes |
| Checksum kept | yes | yes | answered by `put`, not kept |
| Copy, move | in memory | file system | `CopyObject`, 5 GiB per object |
| Bound by `init` | in the tests and the tools, whatever `stack.storage` | `stack.storage: local` | `stack.storage: s3`, MinIO in the compose stack |

## Providers of the S3 protocol

| Provider | Endpoint | Notes |
|---|---|---|
| AWS S3 | none | the reference; region of the bucket |
| MinIO | `http://localhost:9000` in development | path-style addressing; the upstream project stopped publishing images in 2025: the kit's pipeline and compose stack run `pgsty/minio`, built from the same sources, pinned by digest |
| OVHcloud Object Storage | `https://s3.<region>.io.cloud.ovh.net` | European hosting |
| Scaleway Object Storage | `https://s3.<region>.scw.cloud` | European hosting |
| Cloudflare R2 | `https://<account>.r2.cloudflarestorage.com` | region `auto`; no egress fee |
| Garage | your own | self-hosted, small footprint |

`s3ClientOf(settings)` builds a client for any of them: path-style addressing with an endpoint,
and checksums only when an operation requires one, since the default of recent SDKs (a
checksum on every request) is refused by several providers that are not AWS and would bind a
signed upload link to an empty body.

## Selection criteria

1. **More than one instance, or a container that is replaced:** an object store. A directory
   is lost with its machine and is not shared.
2. **Where the data may live:** a provider in the region your obligations name; the bucket, its
   encryption, versioning and lifecycle are infrastructure code, not application code.
3. **Egress:** files downloaded often cost at a provider that charges for egress; R2 does not.
4. **Self-hosting:** MinIO or Garage, each with its operational load.

## What the kit supports and verified

- The contract suite runs on `InMemoryFileStorage` and `LocalFileStorage` in the unit run, and
  on `S3FileStorage` against a real MinIO server in the integration job of the pipeline
  (`pipeline/github/scripts/start-minio.sh`, a service of the GitLab job): round trip with size,
  media type and checksum, six mebibytes streamed across parts, a write refused beyond its
  limit that leaves the previous object and no part behind, keys that could leave their place
  refused, copy, move, listing, signed links that expire, refuse a changed signature or another
  media type.
- `init --storage local|s3` wires the platform: `platform/files/` binds the ports, registers
  the hourly purge of staged files, mounts the routes that answer the links of a served
  storage and the upload reader; `generate file-upload` writes the first upload.
- Not verified: the other providers of the table, which speak the same protocol; a provider
  whose presigned upload ignores the signed `content-type`.

## Another provider: Google Cloud Storage, Azure Blob Storage

A connector is a class of the platform (or a package of your own) that extends `FileStorage`
and passes the contract suite against the real service or its emulator:

```ts
// platform/files/gcs-file-storage.ts
export class GcsFileStorage extends FileStorage {
  constructor(private readonly bucket: Bucket) { super(); }

  async put(key: string, content: FileSource, options: PutOptions): Promise<StoredFile> {
    const inspection = new FileInspection({ maxBytes: options.maxBytes });   // counts, hashes, refuses
    await pipeline(content, inspection, this.bucket.file(assertFileKey(key)).createWriteStream({ contentType: options.mediaType, resumable: true }));
    return { key, size: inspection.size, mediaType: mediaTypeOf(options.mediaType), checksum: inspection.checksum };
  }
  // get, stat, delete, copy, move, list, signedDownloadUrl (v4 signed URL), signedUploadUrl (v4, content-type signed)
}
```

```ts
// test/integration/gcs-file-storage.contract.spec.ts, against fake-gcs-server (Azurite for Azure)
fileStorageContract({ describe, it, expect, beforeEach }, {
  name: 'GcsFileStorage',
  createStorage: () => new GcsFileStorage(freshBucket()),
  elapse: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
});
```

What the suite holds a connector to: a refused write (`FILE_TOO_LARGE`) leaves nothing new and
keeps the previous content, so write to a temporary object or abort the upload; a missing file
answers `undefined` on `get` and `stat`, and `FILE_NOT_FOUND` on `copy` and `move`; an invalid
key is refused before any request (`assertFileKey`); links last at most an hour
(`assertExpiry`); an upload link is bound to its media type; a download link is an attachment,
named or not. Azure signs with a SAS whose
`content-type` cannot be bound: check the type at `FileStaging.confirm`, which every direct
upload goes through anyway.

## Limits and when not to use it

- No connector makes a write part of a database transaction: `FileStaging` orders the work,
  the purge cleans up.
- The local directory and the memory connector answer their links through the application:
  with Express, the routes are mounted before `express.json()`; behind NestJS, its own body
  parser reads a JSON file sent through a link first.
- Files that must not be deleted for a period (legal retention) need object lock on the bucket,
  set by the infrastructure code.
- Content delivery to many readers (images of a public site) belongs to a CDN in front of the
  bucket, not to signed links of the application.

## Recommendation by situation

| Situation | Choice |
|---|---|
| A new project | `init` (local directory), then `init --force --storage s3` before the first deployment |
| Deployed on AWS | `S3FileStorage`, no endpoint |
| European hosting required | OVHcloud or Scaleway through `S3FileStorage` |
| Many downloads | Cloudflare R2 through `S3FileStorage` |
| Self-hosted | MinIO (`pgsty/minio`) or Garage through `S3FileStorage` |
| Google Cloud or Azure only | an adapter of your own held to `fileStorageContract` |

## Sources

- AWS SDK for JavaScript v3, `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`,
  `@aws-sdk/s3-request-presigner`: 3.1150.0, checked with `npm view` on 2026-10-12.
- MinIO server, image `pgsty/minio:RELEASE.2026-08-04T00-00-00Z`
  (`sha256:b6bfe7239bfc83fb90d31612d9704d86039dd714f7904b3f1ad68f211e602372`); `minio/minio`
  answered "denied" on Docker Hub and no tag on Quay on 2026-10-12.
- busboy 1.6.0, the multipart parser of `@ddd-ts-kit/http/uploads`.

## See also

- [File storage](../concepts/file-storage.md): the concept, the consistency order, security.
- [Persistence](persistence.md): what does go in the database.
- [`@ddd-ts-kit/s3`](../../packages/s3/README.md).
