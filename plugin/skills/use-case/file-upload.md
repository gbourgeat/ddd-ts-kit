# A use case that receives a file

Read when the use case receives a file or answers one. `generate file-upload` needs both a file
storage and an HTTP stack: it is refused under `stack.storage: none` and under `stack.http: none`.
On `storage: none`, `npx ddd-ts-kit init --force --storage local` (or `s3`) wires the storage,
with an HTTP stack in `ddd-ts-kit.config.json`. Why never in the database, the ports, the
streaming and the checks of the content, and the signed links are in
`docs/concepts/file-storage.md` of the kit, "Receiving a file" and "Serving a file"; what follows
is the command and what to fill.

```bash
npx ddd-ts-kit generate file-upload <ctx> <UseCase> --path /<resource>/:id/<file> (--permission <aggregate>.<action> --grant <role> | --public) --json
```

It writes:

- a controller that declares the file (size and media types, in the contract). With
  `--text single-byte` (or `utf-8`) the file is a text file, a CSV under the names browsers give
  it, and its spec sends one in Windows-1252 through the multipart reader. Every accepted media
  type needs a content rule (`files/upload-content-rule`): the kit has one for PDF, images, zip
  and text; state the others in `contentRules` (`text` or `unchecked`), or the route is refused
  when declared. The bytes arrive as sent: whoever reads them decodes (`isUtf8` of the kernel);
- a command that carries it as a `FileUpload` (the bus stages it under a key of `FileKeys`
  before the transaction opens);
- a handler that reads `upload.file` and promotes it with the commit (`promoteOnCommit`).

Record the `StoredFile` on the aggregate in that handler; the content never goes in a table
(`persistence/no-file-content`). A download is a query answering a short signed link
(`signedDownloadUrl`).
