import { formatJson } from '../json/format-json.js';

/**
 * The compiler options of a client, built on its own to `dist/`: ECMAScript modules with their
 * declarations, the DOM types of `fetch` and no type of Node, so that it runs in a browser as in
 * Node; strict as the project is.
 */
export const CLIENT_TSCONFIG = formatJson({
  compilerOptions: {
    target: 'ES2022',
    lib: ['ES2022', 'DOM'],
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    types: [],
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    verbatimModuleSyntax: true,
    declaration: true,
    composite: true,
    skipLibCheck: true,
    rootDir: 'src',
    outDir: 'dist',
  },
  include: ['src'],
});
