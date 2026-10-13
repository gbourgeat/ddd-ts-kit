/** The business concept a binding holds, by the camel name of one element, and whether it holds several of them. */
export interface ProposedName {
  readonly element: string;
  readonly many: boolean;
}
