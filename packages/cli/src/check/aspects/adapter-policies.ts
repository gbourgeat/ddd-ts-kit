import { bindingCalls } from '../declarations/binding-calls';
import { classesOf } from '../declarations/classes-of';
import type { Decoration } from '../declarations/decoration';
import { optionOf } from '../declarations/option-of';
import type { Project } from '../model/project';
import type { SourceFile } from '../model/source-file';
import { callArguments } from '../text/call-arguments';
import { chainEnd } from '../text/chain-end';
import { splitTopLevel } from '../text/split-top-level';
import type { AdapterPolicy } from './adapter-policy';
import { isUnderCondition } from './is-under-condition';
import { statedPolicy, type StatedPolicy } from './stated-policy';

const ADAPTER_DECORATORS = ['Adapter', 'Gateway'];
const TO_CLASS = /\.\s*toClass\s*\(\s*([A-Za-z_$][\w$]*)/;
const AS = /\.\s*as\s*\(\s*/;
const WITH = /\.\s*with\s*\(/g;
const ASPECTS = /^aspects\s*:\s*\[([\s\S]*)\]$/;
const UNREADABLE: StatedPolicy = { ownPolicy: false, timeouts: [], readable: false };

/** The kind of an adapter as its text states it; `known` is false when it is written as anything but a literal. */
interface StatedKind {
  readonly known: boolean;
  readonly value: string | undefined;
}

/**
 * What binds a port in the sources, with the policy stated there: the `@Adapter` or `@Gateway`
 * above a class (declared style), or a `bind(Port)...` of a file that imports the container of the
 * kit, whose chain `.toClass(Adapter).as(kind).with(...)` is read. A platform wired by hand
 * (`platform.adapter(...)`) states nothing a text can follow.
 */
export function adapterPolicies(project: Project): AdapterPolicy[] {
  return project.files.filter((file) => !file.isTest).flatMap((file) => [...declared(file), ...bound(file)]);
}

function declared(source: SourceFile): AdapterPolicy[] {
  const { scan } = source;

  return classesOf(scan).flatMap(({ name, decorations }) =>
    decorations
      .filter((decoration) => ADAPTER_DECORATORS.includes(decoration.name))
      .map((decoration) => {
        const given = splitTopLevel(scan.code.slice(decoration.open + 1, decoration.close)).map(({ code }) => code);
        const kind = declaredKind(source, decoration);

        return {
          port: given[0] ?? '',
          className: name,
          source,
          kind: kind.value,
          kindKnown: kind.known,
          conditional: false,
          ...declaredPolicy(given.slice(1)),
        };
      }),
  );
}

/** `@Gateway` is a gateway; `@Adapter` is `external` unless its `kind` says otherwise, as the kernel reads it. */
function declaredKind({ scan }: SourceFile, decoration: Decoration): StatedKind {
  if (decoration.name === 'Gateway') {
    return { known: true, value: 'gateway' };
  }

  const kind = optionOf(scan, decoration, 'kind');

  return kind === undefined
    ? { known: true, value: 'external' }
    : { known: kind.literal !== undefined, value: kind.literal };
}

/** The policy the `aspects: [...]` of the options of a declaration states; a list of dependencies is not options. */
function declaredPolicy(settings: readonly string[]): StatedPolicy {
  const options = settings.filter((setting) => !setting.startsWith('['));
  const [first = '{}'] = options;

  if (options.length > 1 || !first.startsWith('{')) {
    return UNREADABLE;
  }

  const properties = splitTopLevel(first.slice(1, -1)).map(({ code }) => code);
  const aspects = properties.find((property) => /^aspects(?![\w$])/.test(property));
  const listed = aspects === undefined ? '' : ASPECTS.exec(aspects)?.[1];

  return listed === undefined || properties.some((property) => property.startsWith('...'))
    ? UNREADABLE
    : statedPolicy(elementsOf(listed));
}

function bound(source: SourceFile): AdapterPolicy[] {
  const { code } = source.scan;

  return bindingCalls(source)
    .filter(({ method }) => method === 'bind')
    .map(({ open, token }) => {
      const chain = code.slice(open, chainEnd(code, open + 1));
      const kind = boundKind(source, chain, open);

      return {
        port: token?.code ?? '',
        className: TO_CLASS.exec(chain)?.[1],
        source,
        kind: kind.value,
        kindKnown: kind.known,
        conditional: isUnderCondition(code, open),
        ...statedPolicy([...chain.matchAll(WITH)].flatMap((call) => elementsOf(givenTo(chain, call)))),
      };
    });
}

/** The literal given to `.as(...)`; a binding without `.as(...)` has no kind, and no policy of a kind goes around it. */
function boundKind({ scan }: SourceFile, chain: string, chainStart: number): StatedKind {
  const as = AS.exec(chain);

  if (as === null) {
    return { known: true, value: undefined };
  }

  const kindAt = chainStart + as.index + as[0].length;
  const literal = scan.strings.find((candidate) => candidate.start === kindAt);

  return { known: literal !== undefined, value: literal?.value };
}

function givenTo(chain: string, call: RegExpExecArray): string {
  return callArguments(chain, call.index + call[0].length - 1)
    .map(({ code }) => code)
    .join(', ');
}

function elementsOf(list: string): string[] {
  return splitTopLevel(list)
    .map(({ code }) => code)
    .filter((code) => code !== '');
}
