/** The choices of a stack, as the flags of `init` name them. */
export interface StackFlags {
  readonly http: string;
  readonly validation: string;
  readonly di: string;
  readonly tests: string;
  readonly orm: string;
  readonly events: string;
  readonly authn?: string;
  readonly authz?: string;
  readonly broker?: string;
  readonly ci?: string;
  readonly cache?: string;
  readonly audit?: string;
  readonly errors?: string;
  readonly logger?: string;
  readonly style?: string;
  readonly assembly?: string;
  readonly storage?: string;
}
