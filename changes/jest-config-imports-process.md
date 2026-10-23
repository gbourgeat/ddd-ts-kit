**The Jest configuration of a generated project passes its own lint.** `jest.config.js` read `process.env.CI` without importing `process`, which the lint of the project (`no-undef`, since a JavaScript file has no type information) reported as soon as the file was linted; `knexfile.js` already imported it from `node:process`. The configuration now imports it the same way.

To move: add `import process from 'node:process';` at the top of `jest.config.js`, or run `ddd-ts-kit init --force`.
