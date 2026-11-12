import { argumentsOf } from '../declarations/arguments-of';
import { bindingCalls } from '../declarations/binding-calls';
import { classesOf } from '../declarations/classes-of';
import type { Decoration } from '../declarations/decoration';
import { optionOf } from '../declarations/option-of';
import type { Project } from '../model/project';
import type { SourceFile } from '../model/source-file';
import { chainEnd } from '../text/chain-end';
import type { AdapterPolicy } from './adapter-policy';
import { statedTimeouts } from './stated-timeouts';

const ADAPTER_DECORATORS = ['Adapter', 'Gateway'];
const OWN_POLICY = /(?<![\w$.])ownPolicy\s*\(/;
const CONDITIONAL = /(?<![\w$.])when\s*\(/;
const TO_CLASS = /\.\s*toClass\s*\(\s*([A-Za-z_$][\w$]*)/;
const AS = /\.\s*as\s*\(\s*/;

/** The kind of an adapter as its text states it; `known` is false when it is written as anything but a literal. */
interface StatedKind {
  readonly known: boolean;
  readonly value: string | undefined;
}

/**
 * The policy of each adapter the project binds to a port, where it is stated: the `@Adapter` or
 * `@Gateway` above a class (declared style), or the chain `bind(Port).toClass(Adapter).as(kind).with(...)`
 * of a file that imports the container of the kit. A platform wired by hand states nothing a text can follow.
 */
export function adapterPolicies(project: Project): AdapterPolicy[] {
  return project.files.filter((file) => !file.isTest).flatMap((file) => [...declared(file), ...bound(file)]);
}

function declared(source: SourceFile): AdapterPolicy[] {
  const { scan } = source;

  return classesOf(scan).flatMap(({ name, decorations }) =>
    decorations
      .filter((decoration) => ADAPTER_DECORATORS.includes(decoration.name))
      .map((decoration) =>
        policyOf(
          { port: argumentsOf(scan, decoration)[0]?.code ?? '', className: name, source },
          declaredKind(source, decoration),
          scan.code.slice(decoration.open, decoration.close + 1),
        ),
      ),
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

function bound(source: SourceFile): AdapterPolicy[] {
  const { code } = source.scan;

  return bindingCalls(source).flatMap(({ method, open, token }) => {
    const chain = code.slice(open, chainEnd(code, open + 1));
    const className = method === 'bind' ? TO_CLASS.exec(chain)?.[1] : undefined;

    return className === undefined
      ? []
      : [policyOf({ port: token?.code ?? '', className, source }, boundKind(source, chain, open), chain)];
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

function policyOf(
  adapter: Pick<AdapterPolicy, 'port' | 'className' | 'source'>,
  kind: StatedKind,
  code: string,
): AdapterPolicy {
  const ownPolicy = OWN_POLICY.test(code);
  const { timeouts, readable } = statedTimeouts(code, 'timeout');

  return {
    ...adapter,
    kind: kind.value,
    ownPolicy,
    timeouts,
    readable: readable && !CONDITIONAL.test(code) && (ownPolicy || kind.known),
  };
}
