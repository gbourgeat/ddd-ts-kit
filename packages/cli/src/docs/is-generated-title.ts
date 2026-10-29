import { listTemplates, readTemplate } from '../templating';
import { rulesIn } from './rules-in';
import { allRules } from './all-rules';
import { SPEC_ROLES } from './spec-roles';

/** The role of a spec template whose name says it in other words than the spec it writes: `value-object.spec.ts.tpl` writes `<name>.vo.spec.ts`. */
const TEMPLATE_ROLES: Readonly<Record<string, string>> = {
  'value-object': 'vo',
  'domain-error': 'error',
  'concept-error': 'error',
  case: 'error',
  refusal: 'error',
  'refusal-case': 'error',
  'domain-event': 'event',
  'domain-service': 'service',
  'e2e-job': 'e2e',
  'e2e-reaction': 'e2e',
  'erasure-handler': 'integration-handler',
  upload: 'controller',
  'timeout-job': 'background-job',
  simulated: 'adapter',
};

/** The roles whose template writes a spec named after its adapter, whatever its role: `in-memory-<query>-reader.repository.spec.ts`. */
const ANY_ROLE = new Set(['reader']);

/** The words of a name the kit substitutes: a name, never a sentence, so that a rule written in the shape of a template stays the project's. */
const NAME_WORDS = '[a-z0-9]+(?: [a-z0-9]+){0,4}';

/** What a placeholder of a title can be rendered as, by the last segment of its name; any other one is any text. */
const PLACEHOLDERS: Readonly<Record<string, string>> = {
  words: NAME_WORDS,
  commandWords: NAME_WORDS,
  title: '[A-Z][a-z0-9]*(?: [a-z0-9]+){0,4}',
  kebab: '[a-z0-9]+(?:-[a-z0-9]+)*',
  pascal: '[A-Z][A-Za-z0-9]*',
  code: '[A-Z][A-Z0-9_]*',
  permission: '[a-z0-9-]+(?:\\.[a-z0-9-]+)+',
  status: '\\d{3}',
  method: '[A-Z]+',
  path: '/\\S*',
  version: '\\d+',
  article: 'an?',
  asActor: '(?: as [a-z ]+)?',
  name: '[\\w.-]+',
  type: '[\\w.-]+',
  eventName: '[\\w.-]+',
  initialValue: '[\\w-]+',
  table: '\\w+',
};

/** A title of a template: its pattern, the names of the kit substituted, and the role of the specs it is written in, none when any spec may hold it. */
interface TemplateTitle {
  readonly role: string | undefined;
  readonly pattern: RegExp;
}

let titles: readonly TemplateTitle[] | undefined;

/**
 * Whether a title of a spec of that role is one a template of the kit writes, word for word once its names are
 * substituted: `saves the invoice and answers its identifier` in a handler spec. Read from the spec
 * templates of the package, once, and only for the specs of the role each template writes.
 */
export function isGeneratedTitle(role: string | undefined, title: string): boolean {
  titles ??= templateTitles();

  return titles.some(
    (candidate) => (candidate.role === undefined || candidate.role === role) && candidate.pattern.test(title),
  );
}

function templateTitles(): TemplateTitle[] {
  return listTemplates()
    .filter((template) => /(?:^|[./])spec(?:\.[\w-]+)?\.ts\.tpl$/.test(template))
    .flatMap((template) =>
      allRules(rulesIn(readTemplate(template))).map((rule) => ({
        role: templateRole(template),
        pattern: patternOf(rule.title),
      })),
    );
}

/** `query/search.handler.spec.buses.ts.tpl` writes the spec of a handler: the last segment before `spec` that names a role. */
function templateRole(template: string): string | undefined {
  const name = template.slice(template.lastIndexOf('/') + 1);
  const segments = name.slice(0, name.lastIndexOf('spec')).split('.');

  const role = segments
    .map((segment) => TEMPLATE_ROLES[segment] ?? (SPEC_ROLES[segment] === undefined ? undefined : segment))
    .findLast((candidate) => candidate !== undefined);

  return role === undefined || ANY_ROLE.has(role) ? undefined : role;
}

/** The whole title, each `{{name}}` read as what it renders, each `{{#if}}...{{/if}}` as what may be there. */
function patternOf(title: string): RegExp {
  const source = title
    .split(/(\{\{[^}]*\}\})/)
    .map((part) => {
      if (!part.startsWith('{{')) {
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }

      const inner = part.slice(2, -2).trim();

      if (inner.startsWith('#')) {
        return '(?:';
      }

      if (inner.startsWith('/')) {
        return ')?';
      }

      return inner === 'else' ? '|' : (PLACEHOLDERS[inner.slice(inner.lastIndexOf('.') + 1)] ?? '.+?');
    })
    .join('');

  return new RegExp(`^${source}$`);
}
