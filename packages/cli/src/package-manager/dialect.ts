/** How one package manager writes what the templates write for npm: an ordered list of [what npm says, what it says]. */
export type Dialect = readonly (readonly [RegExp, string])[];
