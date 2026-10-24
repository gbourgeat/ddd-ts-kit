/** What a purge did: the rows each copy reached, by the name of the copy. */
export interface PersonalDataPurgeReport {
  readonly purged: Readonly<Record<string, number>>;
}
