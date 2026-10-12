import type { Name } from '../../../naming/index.js';
import type { RenderContext } from '../../../templating/index.js';

export interface GroupDeclaration {
  readonly name: Name;
  readonly prefix: string;
  readonly tag: string;
  /** The class and the import of the parent group, when the group refines one. */
  readonly parent?: { readonly className: string; readonly specifier: string };
  readonly access: 'authenticated' | 'public' | 'inherited';
  readonly role?: string;
}

/** What the template of a route group reads: its imports and the options of its decorator. */
export function groupVars(group: GroupDeclaration): RenderContext {
  const guard = guardOf(group);
  const { parent, prefix } = group;

  const options = [
    ...(parent === undefined ? [] : [`parent: ${parent.className}`]),
    ...(prefix === '' ? [] : [`prefix: '${prefix}'`]),
    ...(parent === undefined ? [`tags: ['${group.tag}']`] : []),
    ...(guard === undefined ? [] : [`guards: [${guard.written}]`]),
    ...(guard !== undefined && guard.name !== 'Public' && parent === undefined ? ["errors: ['FORBIDDEN']"] : []),
  ];

  return {
    pascal: group.name.pascal,
    words: group.name.words,
    imports: [
      `import { ${[...(guard === undefined ? [] : [guard.name]), 'RouteGroup'].join(', ')} } from '@ddd-ts-kit/http';`,
      ...(parent === undefined ? [] : [`import { ${parent.className} } from '${parent.specifier}';`]),
    ].join('\n'),
    options: options.join(', '),
  };
}

function guardOf({ access, role }: GroupDeclaration): { name: string; written: string } | undefined {
  if (role !== undefined) {
    return { name: 'HasRole', written: `HasRole('${role}')` };
  }

  if (access === 'inherited') {
    return undefined;
  }

  return access === 'public'
    ? { name: 'Public', written: 'Public' }
    : { name: 'Authenticated', written: 'Authenticated' };
}
