import { bindingCalls } from '../declarations/binding-calls';
import { dependencyLists } from '../declarations/dependency-lists';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { perFile } from '../support/per-file';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

interface Named {
  readonly name: string;
  readonly line: number;
  readonly where: string;
}

export const portsValueImport: Rule = {
  id: 'ports/value-import',
  description:
    'A class named in a dependency list or bound with bind or rebind is imported as a value, never with `import type`: the class is the token.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      const typeOnly = new Set(file.imports.flatMap(({ typeNames }) => typeNames));

      return tokensOf(file)
        .filter(({ name }) => typeOnly.has(name))
        .map(({ name, line, where }) => ({
          line,
          message: `${name} is imported as a type and named in ${where}: at run time the token would be undefined.`,
          fix: `Import it as a value, \`import { ${name} } from '...'\`, without \`type\`: the abstract class is the injection token, so it has to exist when the file runs.`,
        }));
    });
  },
};

/** The names a file uses as injection tokens: in its dependency lists and as the first argument of `bind` and `rebind`. */
function tokensOf(file: SourceFile): Named[] {
  const listed = dependencyLists(file).flatMap(({ owner, names }) =>
    names.map(({ name, line }) => ({ name, line, where: `the dependency list of ${owner}` })),
  );

  const bound = bindingCalls(file)
    .filter(({ method, token }) => (method === 'bind' || method === 'rebind') && IDENTIFIER.test(token?.code ?? ''))
    .map(({ method, token, line }) => ({ name: token?.code ?? '', line, where: `${method}(...)` }));

  return [...listed, ...bound];
}
