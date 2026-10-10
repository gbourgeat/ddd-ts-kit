export interface PageLimits {
  readonly defaultSize: number;
  readonly maxSize: number;
}

export const DEFAULT_PAGE_LIMITS: PageLimits = Object.freeze({ defaultSize: 20, maxSize: 100 });
