import type { ImportTarget } from '../project/resolve-import.js';
import { defineRule } from '../support/rule/define-rule.js';
import { dependencyListListener } from '../support/ports/dependency-list-listener.js';
import { importedBindings } from '../support/ports/imported-bindings.js';

export const portsNoConcreteDependency = defineRule<'concrete'>({
  id: 'ports/no-concrete-dependency',
  type: 'problem',
  recommended: 'error',
  description: 'A dependency list names ports, never the class that implements one: nothing imported from infrastructure/ or from test/fakes/.',
  messages: {
    concrete:
      '{{name}} is named in a dependency list but comes from {{where}}: a list names ports, never what implements them. Name the port (the abstract class of domain/repositories or application/ports that {{name}} implements) and let the declaration of the adapter, the module file or a `fake(Port, ..)` of the test say which class stands behind it.',
  },
  create({ file, sourceCode, report }) {
    const imported = importedBindings(file, sourceCode.ast);

    return dependencyListListener(sourceCode.ast, (dependency) => {
      const where = concretePlace(imported.get(dependency.name)?.target);

      if (where !== undefined) report({ node: dependency, messageId: 'concrete', data: { name: dependency.name, where } });
    });
  },
});

function concretePlace(target: ImportTarget | undefined): string | undefined {
  if (target?.kind !== 'file' || target.location.area !== 'context') return undefined;

  const { layer, inside } = target.location;

  if (layer === 'infrastructure') return 'infrastructure/';

  return layer === 'test' && inside[0] === 'fakes' ? 'test/fakes/' : undefined;
}
