import { Writable } from 'node:stream';

/** A destination stream kept in memory: what the library really wrote, line by line. */
export class MemorySink {
  readonly stream: Writable;
  private readonly chunks: string[] = [];

  constructor() {
    this.stream = new Writable({
      write: (chunk: Buffer | string, _encoding, done) => {
        this.chunks.push(chunk.toString());
        done();
      },
    });
  }

  text(): string {
    return this.chunks.join('');
  }

  records(): Record<string, unknown>[] {
    return this.text()
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }
}
