/** A listing reached more subjects than `listLimit`: an incomplete list is never returned. */
export class ReverseExpansionLimitError extends Error {
  constructor(limit: number) {
    super(
      `The reverse expansion walked through more than ${limit} subjects. Narrow the model or delegate listing to a dedicated service.`,
    );

    this.name = 'ReverseExpansionLimitError';
  }
}
