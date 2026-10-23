/** What scheduling asks identity about people: the name to show for a patient, and nothing else. */
export abstract class PersonDirectoryGateway {
  /** The names of the people known among these identifiers, by identifier; an unknown one is left out. One call for a whole page. */
  abstract namesOf(personIds: readonly string[]): Promise<ReadonlyMap<string, { readonly displayName: string }>>;
}
