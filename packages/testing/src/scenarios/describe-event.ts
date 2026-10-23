import type { DomainEvent } from '@ddd-ts-kit/kernel';
import { show } from './show';

export function describeEvent(event: DomainEvent): string {
  const { name, ...rest } = event;

  return `${name} ${show(rest)}`;
}
