import type { Dependencies } from './dependencies.js';
import type { DependenciesFromSignature } from './dependencies-from-signature.js';

/** What the decorator of a class says of its dependencies: a list, or that the constructor states them. */
export type DeclaredDependencies = Dependencies | DependenciesFromSignature;
