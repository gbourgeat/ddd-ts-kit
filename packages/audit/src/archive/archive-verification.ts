/** What a verification of an archive found: whole, or the first thing that does not hold. */
export type ArchiveVerification =
  | { readonly valid: true; readonly entries: number }
  | {
      readonly valid: false;
      /** `digest`: the file is not the one archived; `range`: not the entries it names; `chain`: an entry that does not seal or link; `anchor`: it does not end on the hash the trail goes on from. */
      readonly reason: 'digest' | 'range' | 'chain' | 'anchor';
      /** The sequence where the chain stops holding, for `chain`. */
      readonly sequence?: number;
    };
