/** The stack flags of `init`, as they were typed. */
export interface StackOptions {
  readonly http?: string;
  readonly validation?: string;
  readonly di?: string;
  readonly tests?: string;
  readonly orm?: string;
  readonly database?: string;
  readonly events?: string;
  readonly docsUi?: string;
  readonly ci?: string;
  readonly authn?: string;
  readonly authz?: string;
  readonly broker?: string;
  readonly cache?: string;
  readonly audit?: string;
  readonly errors?: string;
  readonly logger?: string;
  readonly style?: string;
  readonly assembly?: string;
  /** The reason given for running an ORM without the transactional outbox. */
  readonly allowNoOutbox?: string;
  readonly force: boolean;
}
