import type { RuleDoc } from '../model/rule-doc.js';

export const IMPORTS_DOCS: Readonly<Record<string, RuleDoc>> = {
  'imports/alias-only': {
    why: 'An alias names a file from the root of the project: the import reads the same from every file, says which context and which layer it reaches without counting "../", and does not change when the importing file moves. One way of writing an import also means one thing to review and one thing for the boundary rules to read: the checker, ESLint and dependency-cruiser resolve an alias exactly as they resolve a relative path, so no boundary is crossed by choosing the other spelling. The rule holds under the source root, test/ and scripts/, the same directory included, for import, export ... from and import(). The alias is a subpath import declared once in package.json, which Node itself resolves: the compiled output runs with plain `node`. An alias path with a "." or ".." segment is refused too, since it could name a file outside its directory. The compiler reports an alias that names no file; a JavaScript file at the project root (a config, a migration) is not judged. ESLint fixes the import (`eslint --fix`).',
    bad: `// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { Invoice } from '../../../domain/aggregates/invoice.aggregate.js';
import { IssueInvoiceCommand } from './issue-invoice.command.js';`,
    good: `// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { IssueInvoiceCommand } from '#src/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';
import { Invoice } from '#src/contexts/billing/domain/aggregates/invoice.aggregate.js';
// test/e2e/issue-invoice.e2e.spec.ts
import { startApplication } from '#test/e2e/support/start-application.js';`,
  },
  'imports/alias-declared': {
    why: 'An alias is declared in one place and resolved by many tools: Node, the compiler, the dev runner, the test runner, ESLint, the checker, dependency-cruiser and knip. If two of them disagree, the type check passes on one file while production loads another, or the tests run a stale build. So there is one declaration a person edits, "importAlias" in ddd-ts-kit.config.json, and one derived from it that the tools read, "imports" in package.json: the source file under the condition "ddd-ts-kit-source", the compiled file otherwise. The rule compares the two with what tsconfig says of rootDir and outDir, refuses a second mapping (tsconfig or knip "paths", another "imports" entry under the alias), and checks that everything that runs or reads the sources sets the condition: tsx in the scripts, vitest or jest in their config, dependency-cruiser in its generated config. An alias Node cannot resolve from package.json ("@/", or "#/" on Node 22) is refused.',
    bad: `// ddd-ts-kit.config.json
"importAlias": "@/"
// tsconfig.json
"paths": { "@/*": ["./src/*"] }
// package.json
"dev": "tsx watch src/main.ts"`,
    good: `// ddd-ts-kit.config.json
"importAlias": "#src/"
// package.json
"imports": {
  "#src/*.js": { "ddd-ts-kit-source": "./src/*.ts", "default": "./dist/src/*.js" },
  "#test/*.js": "./test/*.ts",
  "#scripts/*.js": { "ddd-ts-kit-source": "./scripts/*.ts", "default": "./dist/scripts/*.js" }
},
"scripts": { "dev": "tsx watch --conditions=ddd-ts-kit-source src/main.ts" }`,
  },
};
