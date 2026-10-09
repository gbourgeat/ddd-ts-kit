import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { CallGraph } from './call-graph.js';
import { className, enclosingMember, isCallable, keyName, memberName, visibilityOf } from './classes.js';

export type ClassMessageId = 'nonPublicBeforePublic' | 'staticAfterInstance' | 'memberAboveCaller';

export interface ClassFinding {
  readonly node: TSESTree.Node;
  readonly messageId: ClassMessageId;
  readonly data: Readonly<Record<string, string | number>>;
}

interface MemberUse {
  readonly name: string;
  readonly owner: TSESTree.ClassElement;
  readonly node: TSESTree.MemberExpression;
}

type Callable = TSESTree.MethodDefinition | TSESTree.PropertyDefinition;

/** Remembers every `this.x`, `this.#x` and `ClassName.x` met during the traversal, per class. */
export class MemberUses {
  readonly #byClass = new Map<TSESTree.ClassBody, MemberUse[]>();

  record(node: TSESTree.MemberExpression): void {
    const name = node.computed ? undefined : keyName(node.property);
    const site = enclosingMember(node);
    if (name === undefined || site === undefined || !isOwnReceiver(node.object, site.body)) return;
    const uses = this.#byClass.get(site.body) ?? [];
    uses.push({ name, owner: site.member, node });
    this.#byClass.set(site.body, uses);
  }

  of(body: TSESTree.ClassBody): readonly MemberUse[] {
    return this.#byClass.get(body) ?? [];
  }
}

export function misplacedMembers(body: TSESTree.ClassBody, uses: readonly MemberUse[]): ClassFinding[] {
  const callables = body.body.filter(isCallable);
  const owner = className(body.parent);
  const early = nonPublicBeforePublic(callables, owner);
  const reported = new Set(early.map((finding) => finding.node));
  const remaining = callables.filter((member) => visibilityOf(member) === 'private' && !reported.has(member.key));
  const graph = callGraph(callables, uses);
  return [...early, ...staticAfterInstance(callables, owner), ...remaining.flatMap((member) => aboveFirstCaller({ member, uses, graph, owner }))];
}

function isOwnReceiver(receiver: TSESTree.Node, body: TSESTree.ClassBody): boolean {
  if (receiver.type === AST_NODE_TYPES.ThisExpression) return true;
  return receiver.type === AST_NODE_TYPES.Identifier && receiver.name === body.parent.id?.name;
}

function nonPublicBeforePublic(callables: readonly Callable[], owner: string): ClassFinding[] {
  const lastPublic = callables.findLast((member) => visibilityOf(member) === 'public');
  if (lastPublic === undefined) return [];
  return callables
    .filter((member) => visibilityOf(member) !== 'public' && member.range[0] < lastPublic.range[0])
    .map((member) => ({
      node: member.key,
      messageId: 'nonPublicBeforePublic',
      data: { name: label(member), visibility: visibilityOf(member), className: owner, publicName: label(lastPublic) },
    }));
}

function staticAfterInstance(callables: readonly Callable[], owner: string): ClassFinding[] {
  const publics = callables.filter((member) => visibilityOf(member) === 'public');
  const firstInstance = publics.find((member) => !member.static);
  if (firstInstance === undefined) return [];
  return publics
    .filter((member) => member.static && member.range[0] > firstInstance.range[0])
    .map((member) => ({
      node: member.key,
      messageId: 'staticAfterInstance',
      data: { name: label(member), className: owner, instanceName: label(firstInstance) },
    }));
}

function callGraph(callables: readonly Callable[], uses: readonly MemberUse[]): CallGraph<TSESTree.ClassElement> {
  const graph = new CallGraph<TSESTree.ClassElement>();
  for (const use of uses) {
    for (const callee of callables.filter((member) => memberName(member) === use.name)) graph.add(use.owner, callee);
  }
  return graph;
}

interface Judged {
  readonly member: Callable;
  readonly uses: readonly MemberUse[];
  readonly graph: CallGraph<TSESTree.ClassElement>;
  readonly owner: string;
}

function aboveFirstCaller({ member, uses, graph, owner }: Judged): ClassFinding[] {
  const name = memberName(member);
  const callers = uses.filter((use) => use.name === name && use.owner !== member && !graph.reaches(member, use.owner));
  const first = callers.reduce<MemberUse | undefined>((earliest, use) => (earliest === undefined || use.node.range[0] < earliest.node.range[0] ? use : earliest), undefined);
  if (first === undefined || first.node.range[0] < member.range[0]) return [];
  return [{ node: member.key, messageId: 'memberAboveCaller', data: { name: label(member), className: owner, line: first.node.loc.start.line } }];
}

function label(member: Callable): string {
  return memberName(member) ?? 'with a computed name';
}
