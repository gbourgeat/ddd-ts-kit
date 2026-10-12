import { Writable } from 'node:stream';

/** The end of a pipeline that keeps every chunk: for the storage of the tests only. */
export function collect(chunks: Buffer[]): Writable {
  return new Writable({
    write(chunk: Buffer, _encoding, done) {
      chunks.push(chunk);
      done();
    },
  });
}
