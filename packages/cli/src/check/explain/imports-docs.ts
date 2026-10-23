import type { RuleDoc } from '../model/rule-doc';

export const IMPORTS_DOCS: Readonly<Record<string, RuleDoc>> = {
  'imports/alias-only': {
    why: 'An alias names a file from the root of the project: the import reads the same from every file, says which context and which layer it reaches without counting "../", and does not change when the importing file moves. One way of writing an import also means one thing to review and one thing for the boundary rules to read: the checker, ESLint and dependency-cruiser resolve an alias exactly as they resolve a relative path, so no boundary is crossed by choosing the other spelling. The rule holds under the source root, test/ and scripts/, the same directory included, for import, export ... from and import(). The alias is declared once, under "paths" in tsconfig.json, and the build rewrites it into a relative path in the compiled output, which runs with plain `node`. An alias path with a "." or ".." segment is refused too, since it could name a file outside its directory. The compiler reports an alias that names no file; a JavaScript file at the project root (a config, a migration) is not judged. ESLint fixes the import (`eslint --fix`) and writes it with the ending "importExtension" asks for, which `imports/extension` holds.',
    bad: `// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { Invoice } from '../../../domain/aggregates/invoice.aggregate';
import { IssueInvoiceCommand } from './issue-invoice.command';`,
    good: `// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command';
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';
// test/e2e/issue-invoice.e2e.spec.ts
import { startApplication } from '$test/e2e/support/start-application';`,
  },
  'imports/extension': {
    why: 'An import of a file of the project has one spelling, and "importExtension" in ddd-ts-kit.config.json says which. Under "none", the default of a new project, it names the file without an extension: the compiler resolves as a bundler does ("moduleResolution": "Bundler"), which still reports a file that does not exist but would also accept ".js", so this rule is what refuses it. Under "js", which is also what a config without the key means, it ends with the ".js" of the file the compiler emits: the compiler resolves as Node does and refuses any other spelling itself (TS2835); this rule says it in the words of the project and ESLint fixes it. Node needs the extension at run time either way: `ddd-ts-kit build-aliases` rewrites each alias of the compiled output into a relative path ending in ".js". Under "none" an alias may name a directory (".../published-language"): the compiler resolves its index.ts and the build completes it with "/index.js". Only a specifier that starts with an alias of the project is judged: a package subpath that ends like a file name ("zod/v4/core.js") is left alone, and a relative import belongs to imports/alias-only. A dot in a file name is not an extension: "invoice.aggregate" is written without one. To move a project from one spelling to the other: change "importExtension", write the "module" and "moduleResolution" that imports/alias-declared then asks for, run `eslint --fix` and the formatter.',
    bad: `// ddd-ts-kit.config.json
"importExtension": "none"
// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';
import { InvoiceIssued } from '@/contexts/billing/published-language';`,
    good: `// ddd-ts-kit.config.json
"importExtension": "none"
// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';
import { InvoiceIssued } from '@/contexts/billing/published-language';`,
  },
  'imports/alias-declared': {
    why: 'An alias is declared in one place and resolved by many tools: the compiler, the dev runner, the test runner, ESLint, the checker, dependency-cruiser, knip, and the build that makes the output runnable. If two of them disagree, the type check passes on one file while production loads another, or a boundary rule stops seeing an import. So there is one source a person edits, "importAlias" in ddd-ts-kit.config.json, and one declaration derived from it that the tools read, "paths" in tsconfig.json. Node reads neither: the compiler emits an alias as it was written, so `ddd-ts-kit build-aliases` rewrites each one into a relative path after the compiler, and the output runs with plain `node`. The rule compares "paths" (tsconfig.json and tsconfig.build.json) with "importAlias", refuses a second entry under an alias, a "baseUrl" and a knip "paths"; checks that vitest and dependency-cruiser read tsconfig and that jest, which does not, repeats the same mapping; reports a script that compiles without the rewrite step and a tsx script under another tsconfig. The ending of an import has one source too, "importExtension", and three declarations follow it: "module" and "moduleResolution" of tsconfig.json ("ESNext" and "Bundler" without an extension, a Node resolution with one), the pattern of each jest mapping, and the build step, which writes the ".js" Node needs. An alias is "@/" or "$<name>/": neither can be the name of a package, so no installed dependency can ever take the place of a file of the project; "#<name>/" (a Node subpath import) and "@<name>/" (the name of a scope) are refused.',
    bad: `// ddd-ts-kit.config.json
"importAlias": "@/", "importExtension": "none"
// tsconfig.json
"moduleResolution": "NodeNext",
"paths": { "@/*": ["./dist/src/*"] }
// package.json
"build": "tsc -p tsconfig.build.json"`,
    good: `// ddd-ts-kit.config.json
"importAlias": "@/", "importExtension": "none"
// tsconfig.json
"module": "ESNext", "moduleResolution": "Bundler", "customConditions": ["node"],
"paths": { "@/*": ["./src/*"], "$test/*": ["./test/*"], "$scripts/*": ["./scripts/*"] }
// package.json
"build": "tsc -p tsconfig.build.json && ddd-ts-kit build-aliases"
// vitest.config.ts
resolve: { tsconfigPaths: true }`,
  },
};
