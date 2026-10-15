import type { Config } from '../config/index.js';
import type { Workspace } from '../workspace/index.js';

export interface KindFlags {
  readonly classification?: string;
  readonly purpose?: string;
  readonly upstream: readonly string[];
  /** `<Term>=<meaning>` rows to add to the glossary of the context. */
  readonly term: readonly string[];
  /** `generate context --preset <name>`: the context is written whole from that preset. */
  readonly preset?: string;
  /** The values of a closed vocabulary, one per `--value`. */
  readonly value: readonly string[];
  /** The transitions of a state machine, one per `--transition "<intention>:<from>[,<from>]...[><to>]"`. */
  readonly transition: readonly string[];
  readonly code?: string;
  readonly aggregate?: string;
  readonly method?: string;
  readonly path?: string;
  /** A route calls the command of the name, not its query. */
  readonly command: boolean;
  readonly query: boolean;
  /** The use case a job sends, as `--command <UseCase>`. */
  readonly commandName?: string;
  /** The schedule of a job: an interval, or a cron expression read in a time zone. */
  readonly every?: string;
  readonly cron?: string;
  readonly timeZone?: string;
  readonly version?: string;
  readonly allowName: boolean;
  /** The permission a use case requires, as `<aggregate>.<action>`. */
  readonly permission?: string;
  /** The role that holds the new permission, written in the roles of the platform. */
  readonly grant?: string;
  /** The use case is reachable by anybody, on purpose. */
  readonly public: boolean;
  readonly tenantScoped: boolean;
  /** The query answers one page of a search, filtered by the access scope of its actor. */
  readonly search: boolean;
  /** The role an adapter is bound under: `external` or `gateway`. */
  readonly kind?: string;
  /** The adapter carries its resilience policy as standard decorators on its class. */
  readonly decorators: boolean;
  /** What an ADR deviates from, as a config key such as `rules.clean/stepdown`. */
  readonly deviation?: string;
  readonly reason?: string;
  /** The number of a decision record, as `--number <n>`, when the project numbers by block. */
  readonly number?: string;
  /** The name of an element its generator would otherwise derive from another argument, as `--name <Name>`. */
  readonly name?: string;
  /** When a domain event handler runs: `before-commit`, the default, or `after-commit`. */
  readonly phase?: string;
  /** The route group of a controller, or the parent of a group, by its name. */
  readonly group?: string;
  /** The path prefix of a route group. */
  readonly prefix?: string;
  /** The role a route group requires of its callers. */
  readonly role?: string;
  /** A controller gets a request mapper of its own. */
  readonly mapper: boolean;
  /** A controller of a query gets a serializer of its own. */
  readonly serializer: boolean;
  /** The cache policy of a controller: `public`, `private` or `no-store`. */
  readonly cache?: string;
  /** An aggregate keeps its state as the stream of its events. */
  readonly eventSourced: boolean;
}

export interface KindRequest {
  readonly ws: Workspace;
  readonly config: Config;
  /** Positional arguments after the kind. */
  readonly args: readonly string[];
  readonly flags: KindFlags;
  /** `generate controller`: a controller class is written whatever the form of routes the config records. */
  readonly asController?: boolean;
}

export interface Kind {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly usage: string;
  readonly summary: string;
  /** Positional arguments after the kind, by name; all are required. */
  readonly positionals: readonly string[];
  /** True when the kind may write outside the context it is given (config, composition root, registries of the platform, documentation): `SHARED_WRITES` says what and when. */
  readonly writesShared: boolean;
  /** The flags this kind reads as a text where the other kinds read a switch: `--command <UseCase>` of a job. */
  readonly textFlags?: readonly string[];
  run(request: KindRequest): void;
}
