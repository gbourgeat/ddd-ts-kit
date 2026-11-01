import { afterAll, afterEach, beforeAll, describe } from 'vitest';
import { NODES, type SearchNode } from './servers';

/** The node of the running test, and the indices it created, dropped once it ends. */
export interface NodeUnderTest {
  readonly node: SearchNode;
  readonly created: string[];
}

/** A `describe` per node, which starts the node, drops what each test created and stops the node at the end. */
export function onEachNode(title: string, tests: (current: () => NodeUnderTest) => void): void {
  describe.each(NODES)(`${title}, %s`, (_, start) => {
    let held: NodeUnderTest | undefined;

    const current = (): NodeUnderTest => {
      if (held === undefined) {
        throw new Error('The node only exists while a test runs');
      }

      return held;
    };

    beforeAll(async () => {
      held = { node: await start(), created: [] };
    });

    afterEach(async () => {
      await current().node.drop(current().created.splice(0));
    });

    afterAll(async () => {
      await current().node.stop();
    });

    tests(current);
  });
}
