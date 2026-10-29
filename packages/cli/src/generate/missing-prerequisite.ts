import { CliError } from '../cli-error';

/**
 * A refusal of the generator for what a command builds on and an earlier command creates: an
 * aggregate, a port, a use case, a route group, a context, an upstream, the declaration of an
 * event. `plan-waves` runs such a command again once the whole plan has run, to find the row that
 * generates what it needs, or to say that none does.
 */
export class MissingPrerequisite extends CliError {}
