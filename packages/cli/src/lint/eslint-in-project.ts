export const LINT_RUN_VARIABLE = 'DDD_TS_KIT_LINT_RUN';

/**
 * The ESLint of the project, through its API, which is asynchronous where a command of the CLI is
 * not: run by `node --input-type=module --eval`, so that it is the same script from the sources and
 * from the build. A formatter that writes its own file (`gitlab`) writes it here.
 */
export const ESLINT_IN_PROJECT = `
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { root, patterns, format, fix } = JSON.parse(process.env.${LINT_RUN_VARIABLE});
const entry = createRequire(path.join(root, 'package.json')).resolve('eslint');
const { ESLint } = await import(pathToFileURL(entry).href);
const eslint = new ESLint({ cwd: root, fix });
const results = await eslint.lintFiles(patterns.length === 0 ? ['.'] : patterns);

if (fix) {
  await ESLint.outputFixes(results);
}

const rulesMeta = eslint.getRulesMetaForResults(results);
const report = await (await eslint.loadFormatter(format)).format(results, { cwd: root, rulesMeta });
const transitions = Object.fromEntries(
  Object.entries(rulesMeta).flatMap(([id, meta]) =>
    typeof meta?.docs?.transition === 'string' ? [[id, meta.docs.transition]] : [],
  ),
);
const messages = results.flatMap((result) => result.messages.map(({ ruleId, severity }) => ({ ruleId, severity })));

process.stdout.write(JSON.stringify({ report, messages, transitions }));
`;
