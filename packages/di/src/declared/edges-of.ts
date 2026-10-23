import type { Wiring } from '../wiring/wiring';
import type { DeclaredEdges } from './declared-edges';

/** The declared classes of the edge as the application provides them. */
export function edgesOf({ edges }: Pick<Wiring, 'edges'>): DeclaredEdges {
  return {
    list: edges,
    of: (part) => edges.filter((edge) => edge.part === part).map((edge) => edge.target),
  };
}
