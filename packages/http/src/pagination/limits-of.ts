import { DEFAULT_PAGE_LIMITS, type PageLimits } from '@ddd-ts-kit/kernel';

export function limitsOf(options: Partial<PageLimits>): PageLimits {
  return {
    defaultSize: options.defaultSize ?? DEFAULT_PAGE_LIMITS.defaultSize,
    maxSize: options.maxSize ?? DEFAULT_PAGE_LIMITS.maxSize,
  };
}
