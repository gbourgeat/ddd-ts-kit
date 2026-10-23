**`S3FileStorage.put` stores a file larger than one part again.** The SDK read the `size` of the
inspection the content streams through, the bytes counted so far, as the length of the whole
content: once every part was sent, a file larger than `partSize` (8 MiB by default) was refused
with `Expected 0 part(s) but uploaded 3 part(s)` and its upload aborted. A smaller file, sent in
one request, was not affected.
