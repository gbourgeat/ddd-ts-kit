/** What a representation writes: the whole text at once, or its chunks in order, for a list streamed as it is read. */
export type RepresentedBody = string | AsyncIterable<string>;
