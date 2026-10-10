/** The standard origins come first; any other string names an origin of the project. */
export type ExecutionOrigin = 'http' | 'event' | 'schedule' | 'cli' | (string & Record<never, never>);
