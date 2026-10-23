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
  /** The extra jobs of the pipeline, comma-separated, or `none`. */
  readonly ciExtras?: string;
  readonly authn?: string;
  readonly authz?: string;
  readonly broker?: string;
  readonly cache?: string;
  /** `none` or `varnish`: the shared HTTP cache in front of the API. */
  readonly httpCache?: string;
  readonly storage?: string;
  readonly audit?: string;
  readonly errors?: string;
  readonly logger?: string;
  readonly style?: string;
  readonly assembly?: string;
  readonly dependencies?: string;
  readonly refusals?: string;
  readonly routes?: string;
  readonly representations?: string;
  readonly forms?: string;
  readonly schemas?: string;
  readonly valueObjects?: string;
  readonly literals?: string;
  /** `classes` or `free`: whether a value of the model is held to a value object class. */
  readonly values?: string;
  readonly tenancy?: string;
  /** `database`, `redis` or `memory`: where the background jobs wait. */
  readonly queue?: string;
  readonly packageManager?: string;
  /** The prefix of the source root in imports, when it is not the default. */
  readonly importAlias?: string;
  /** `none` or `js`: whether an import of a file of the project ends with the extension of the emitted file. */
  readonly importExtension?: string;
  /** The reason given for running an ORM without the transactional outbox. */
  readonly allowNoOutbox?: string;
  /** `--sdk`: the typed clients of the contract are generated with the project. */
  readonly sdk?: boolean;
  /** `regulated` or `none`: the profile of the coding agents, recorded under `agents.profile`. */
  readonly agentProfile?: string;
  readonly force: boolean;
}
