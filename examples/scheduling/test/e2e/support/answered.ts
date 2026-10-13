/** What every outcome of the typed client of the contract is: a success or a refusal, by status. */
export interface Answered {
  readonly ok: boolean;
  readonly status: number;
}
