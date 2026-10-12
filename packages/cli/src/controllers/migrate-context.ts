import { specifierOf } from '../alias/index.js';
import { toName } from '../naming/index.js';
import type { Migration } from './migration.js';
import { planContext, type ContextPlan, type PlannedController } from './plan-context.js';
import { renderController } from './render-controller.js';

/** The roles a file may play in the folder of a controller: what `naming/suffix` accepts there. */
const ROLES = ['params', 'query', 'headers', 'body', 'accepted', 'answer', 'line'];

/** Turns the function routes of one context into controllers, their files moved; nothing is written when one route blocks. */
export function migrateContext(migration: Migration, context: string): boolean {
  const plan = planContext(migration, context);

  if (plan === undefined) {
    return false;
  }

  writeGroups(migration, plan);

  for (const controller of plan.controllers) {
    writeController(migration, plan, controller);
    moveSpec(migration, plan, controller);
  }

  moveSchemas(migration, plan);

  return true;
}

function writeGroups({ draft }: Migration, { http, groups }: ContextPlan): void {
  for (const group of groups.values()) {
    const options = [
      ...(group.prefix === '' ? [] : [`prefix: '${group.prefix}'`]),
      `tags: [${group.tags.map((tag) => `'${tag}'`).join(', ')}]`,
      'guards: [Authenticated]',
      ...(group.errors.length === 0 ? [] : [`errors: [${group.errors.map((code) => `'${code}'`).join(', ')}]`]),
    ];

    draft.write(
      `${http}/${group.kebab}.routes.ts`,
      `import { Authenticated, RouteGroup } from '@ddd-ts-kit/http';\n\n@RouteGroup({ ${options.join(', ')} })\nexport class ${group.className} {}\n`,
    );
  }
}

function writeController(migration: Migration, plan: ContextPlan, controller: PlannedController): void {
  const { draft, config, renamed, moved } = migration;
  const { route, types, body, resource, isPublic } = controller;
  const group = isPublic ? undefined : plan.groups.get(resource);
  const target = `${plan.http}/${resource}/${route.kebab}/${route.kebab}.controller.ts`;

  const groupImport =
    group === undefined
      ? ''
      : `import { ${group.className} } from '${specifierOf(config, `${plan.http}/${group.kebab}.routes.ts`)}';`;

  draft.write(target, renderController({ route, types, group, body, groupImport }));
  draft.remove(route.file);
  renamed.set(route.file, target);
  moved.push(`${route.kebab}.route.ts -> ${resource}/${route.kebab}/${route.kebab}.controller.ts`);
}

/** A schema file named after a route follows it, under the role its name ends with; any other is shared, under the name it had. */
function moveSchemas({ ws, draft, renamed }: Migration, plan: ContextPlan): void {
  const byLength = [...plan.controllers].sort((left, right) => right.route.kebab.length - left.route.kebab.length);

  for (const name of ws.list(plan.http).filter((file) => file.endsWith('.dto.ts'))) {
    const stem = name.replace(/\.dto\.ts$/, '');

    const owner = byLength.find(
      ({ route }) => ROLES.includes(stem.slice(route.kebab.length + 1)) && stem.startsWith(`${route.kebab}-`),
    );

    const target =
      owner === undefined
        ? `${plan.http}/shared/${name}`
        : `${plan.http}/${owner.resource}/${owner.route.kebab}/${owner.route.kebab}.${stem.slice(owner.route.kebab.length + 1)}.ts`;

    draft.write(target, ws.read(`${plan.http}/${name}`) ?? '');
    draft.remove(`${plan.http}/${name}`);
    renamed.set(`${plan.http}/${name}`, target);
  }
}

/** The spec of the route becomes the spec of the controller alone: its guards have their own. */
function moveSpec({ ws, draft, config }: Migration, plan: ContextPlan, { route }: PlannedController): void {
  const unit = `${config.contextsDir}/${plan.context}/test/unit`;
  const source = ws.read(`${unit}/${route.kebab}.route.spec.ts`);
  const factory = `${toName(route.kebab).camel}Route`;

  if (source === undefined) {
    return;
  }

  const rewritten = source
    .replaceAll(
      new RegExp(String.raw`\b${factory}\(([^()]*)\)`, 'g'),
      `controllerRoute(new ${route.pascal}Controller($1), { guards: 'skip' })`,
    )
    .replace(new RegExp(String.raw`import \{ ${factory} \}`), `import { ${route.pascal}Controller }`)
    .replace(
      /import \{([^}]*)\} from '@ddd-ts-kit\/http';/,
      (_all, names: string) => `import { controllerRoute,${names}} from '@ddd-ts-kit/http';`,
    );

  draft.write(`${unit}/${route.kebab}.controller.spec.ts`, rewritten);
  draft.remove(`${unit}/${route.kebab}.route.spec.ts`);
}
