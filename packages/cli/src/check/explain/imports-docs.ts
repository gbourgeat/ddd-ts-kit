import type { RuleDoc } from '../model/rule-doc.js';

export const IMPORTS_DOCS: Readonly<Record<string, RuleDoc>> = {
  'imports/alias-only': {
    why: 'An alias names a file from the root of the project: the import reads the same from every file, says which context and which layer it reaches without counting "../", and does not change when the importing file moves. One way of writing an import also means one thing to review and one thing for the boundary rules to read: the checker, ESLint and dependency-cruiser resolve an alias exactly as they resolve a relative path, so no boundary is crossed by choosing the other spelling. The rule holds under the source root, test/ and scripts/, the same directory included, for import, export ... from and import(). The alias is declared once, under "paths" in tsconfig.json, and the build rewrites it into a relative path in the compiled output, which runs with plain `node`. An alias path with a "." or ".." segment is refused too, since it could name a file outside its directory. The compiler reports an alias that names no file; a JavaScript file at the project root (a config, a migration) is not judged. ESLint fixes the import (`eslint --fix`).',
    bad: `// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { Invoice } from '../../../domain/aggregates/invoice.aggregate.js';
import { IssueInvoiceCommand } from './issue-invoice.command.js';`,
    good: `// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';
// test/e2e/issue-invoice.e2e.spec.ts
import { startApplication } from '$test/e2e/support/start-application.js';`,
  },
  'imports/alias-declared': {
    why: 'An alias is declared in one place and resolved by many tools: the compiler, the dev runner, the test runner, ESLint, the checker, dependency-cruiser, knip, and the build that makes the output runnable. If two of them disagree, the type check passes on one file while production loads another, or a boundary rule stops seeing an import. So there is one source a person edits, "importAlias" in ddd-ts-kit.config.json, and one declaration derived from it that the tools read, "paths" in tsconfig.json. Node reads neither: the compiler emits an alias as it was written, so `ddd-ts-kit build-aliases` rewrites each one into a relative path after the compiler, and the output runs with plain `node`. The rule compares "paths" (tsconfig.json and tsconfig.build.json) with "importAlias", refuses a second entry under an alias, a "baseUrl" and a knip "paths"; checks that vitest and dependency-cruiser read tsconfig and that jest, which does not, repeats the same mapping; reports a script that compiles without the rewrite step and a tsx script under another tsconfig. An alias is "@/" or "$<name>/": neither can be the name of a package, so no installed dependency can ever take the place of a file of the project; "#<name>/" (a Node subpath import) and "@<name>/" (the name of a scope) are refused.',
    bad: `// ddd-ts-kit.config.json
"importAlias": "@/"
// tsconfig.json
"paths": { "@/*": ["./dist/src/*"] }
// package.json
"build": "tsc -p tsconfig.build.json"`,
    good: `// ddd-ts-kit.config.json
"importAlias": "@/"
// tsconfig.json
"paths": { "@/*": ["./src/*"], "$test/*": ["./test/*"], "$scripts/*": ["./scripts/*"] }
// package.json
"build": "tsc -p tsconfig.build.json && ddd-ts-kit build-aliases"
// vitest.config.ts
resolve: { tsconfigPaths: true }`,
  },
};
