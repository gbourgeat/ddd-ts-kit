/** One fact of a refusal: plain data, so that it can be compared in a test and written in a document. */
export type RefusalFact = string | number | boolean | Date | null | readonly RefusalFact[];

/** What a refusal knows about itself, by name: the values its message was built from. */
export type RefusalFacts = Readonly<Record<string, RefusalFact>>;
