/** Dead letters are a fact of one consumer: each has its own dead stream beside the stream it reads. */
export function deadStreamOf(stream: string, consumer: string): string {
  return `${stream}:${consumer}:dead`;
}
