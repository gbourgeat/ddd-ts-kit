import { decoratorCoverage } from '@ddd-ts-kit/testing/vitest';
import { defineConfig } from 'vitest/config';

// The specs Stryker runs against each mutant of the domain or of the application: the unit specs, which need no database and answer in milliseconds; the integration specs would pay a database per mutant for nothing a unit spec does not already notice.
export default defineConfig({
  // Under `emitDecoratorMetadata` the transform guards every type a decorated class names with a branch no test can take: the statements that apply decorators are kept out of the measure.
  plugins: [decoratorCoverage()],
  // An import alias is resolved from the "paths" of tsconfig.json, which name the sources.
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.spec.ts'],
    exclude: ['src/contexts/*/test/integration/**'],
  },
});
