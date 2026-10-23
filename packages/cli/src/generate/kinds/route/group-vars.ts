import type { Name } from '../../../naming';
import type { RenderContext } from '../../../templating';

export interface GroupDeclaration {
  readonly name: Name;
  readonly prefix: string;
  readonly tag: string;
  /** The class and the import of the parent group, when the group refines one. */
  readonly parent?: { readonly className: string; readonly specifier: string };
  readonly access: 'authenticated' | 'public' | 'inherited';
  /** The role the group requires, as a key of the role vocabulary of the platform and the import of it. */
  readonly role?: { readonly key: string; readonly specifier: string };
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
    imports: importsOf(group, guard?.name).join('\n'),
    options: options.join(', '),
  };
}

function importsOf({ parent, role }: GroupDeclaration, guard: string | undefined): string[] {
  return [
    `import { ${[...(guard === undefined ? [] : [guard]), 'RouteGroup'].join(', ')} } from '@ddd-ts-kit/http';`,
    ...(parent === undefined ? [] : [`import { ${parent.className} } from '${parent.specifier}';`]),
    ...(role === undefined ? [] : [`import { Role } from '${role.specifier}';`]),
  ];
}

function guardOf({ access, role }: GroupDeclaration): { name: string; written: string } | undefined {
  if (role !== undefined) {
    return { name: 'HasRole', written: `HasRole(Role.${role.key})` };
  }

  if (access === 'inherited') {
    return undefined;
  }

  return access === 'public'
    ? { name: 'Public', written: 'Public' }
    : { name: 'Authenticated', written: 'Authenticated' };
}
