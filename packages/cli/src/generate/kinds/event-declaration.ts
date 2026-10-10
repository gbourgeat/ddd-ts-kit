/** The declaration of an integration event, as a published language of this repository writes it. */
export interface EventDeclaration {
  readonly definition: string;
  readonly typeName: string;
  readonly version: number;
}
