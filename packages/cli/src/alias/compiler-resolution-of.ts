import type { CompilerResolution } from './compiler-resolution';

/**
 * What `init` writes in tsconfig.json for "importExtension". `Bundler` resolves a specifier
 * without its extension and still reports one that names no file; it reads the `exports` of a
 * package without the `node` condition, which is given back to it so that the compiler and Node
 * take the same entry. `NodeNext` resolves as Node does and requires the extension. Both emit
 * ECMAScript modules, which `build-aliases` completes.
 */
export function compilerResolutionOf(importExtension: string): CompilerResolution {
  return importExtension === 'none'
    ? { module: 'ESNext', moduleResolution: 'Bundler', customConditions: ['node'] }
    : { module: 'NodeNext', moduleResolution: 'NodeNext' };
}
