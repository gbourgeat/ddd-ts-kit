/** A page as a JSON body: the kernel `Page`, with a mutable list as schemas infer it. */
export interface PageBody<T> {
  items: T[];
  total?: number;
  nextCursor?: string;
}
