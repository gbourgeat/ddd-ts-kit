/** A person as identity shows them to another context: the name to display, nothing else. */
export interface PersonCard {
  readonly personId: string;
  readonly displayName: string;
}

export abstract class PersonDirectoryContract {
  /** The people known among these identifiers; an unknown identifier is left out. */
  abstract byIds(personIds: readonly string[]): Promise<readonly PersonCard[]>;
}
