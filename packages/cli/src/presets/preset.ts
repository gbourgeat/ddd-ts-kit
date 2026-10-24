import type { Config } from '../config';
import type { GlossaryRow } from '../generate/parse-terms';
import type { PresetFile } from './preset-file';
import type { PresetRefusal } from './preset-refusal';
import type { PresetStep } from './preset-step';

/**
 * A bounded context written whole, in the conventions of the kit: its model, its use cases, its
 * adapters, its routes and their specs. What `--preset <name>` of `init` and of `generate context`
 * writes into a context of that name, where a team starts from a context that is generic enough to
 * be designed once (identity, notification) instead of an empty one.
 */
export interface Preset {
  readonly name: string;
  /** What the context is to the business when the preset creates it. */
  readonly classification: string;
  /** Why the context is of that classification, in one sentence. */
  readonly classificationReason: string;
  readonly purpose: string;
  readonly terms: readonly GlossaryRow[];
  /** Why the preset cannot be written in this project, or nothing: a stack it was not written for. */
  refusal(config: Config): PresetRefusal | undefined;
  /** The generators run on the context once its files are written: what they write outside it is what wires it. */
  readonly steps: readonly PresetStep[];
  /**
   * Every signed-in person holds the permissions of the context, its policies deciding on the
   * element: the platform grants them whatever its access model.
   */
  readonly grantsEverySignedInPerson: boolean;
  /** With tenants, the organisations of the context are the tenants: the authenticator reads them from the token. */
  readonly organisationsAreTenants: boolean;
  /** A file only this preset writes in a context: another context holding it was written from the same preset. */
  readonly signature: string;
  /** The files of the context, rendered from `templates/presets/<name>/`. */
  files(config: Config): readonly PresetFile[];
  /**
   * The models and enums of the context on Prisma, a template of `templates/presets/<name>/`: laid
   * out in `prisma/schema.prisma` once the generators ran, each in place of the model they started.
   */
  readonly prismaModels?: string;
}
