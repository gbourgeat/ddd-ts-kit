{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": [
{{#if tests.jest}}
    "{{config.contextsDir}}/*/test/fakes/*.ts",
{{/if}}
{{#if knip.apps}}
    "{{config.sourceRoot}}/apps/*/main.ts",
{{/if}}
    "scripts/*.ts"{{knip.e2eEntry}}
  ],
  "project": ["{{config.sourceRoot}}/**/*.ts", "scripts/**/*.ts"{{knip.e2eProject}}],
{{#if knip.ignores}}
  "ignoreDependencies": {{knip.ignored}},
{{/if}}
  "ignoreExportsUsedInFile": true,
  "vitest": {
    "config": ["vitest.config.ts"{{knip.e2eConfig}}],
    "entry": [
      "{{config.sourceRoot}}/**/*.spec.ts",
      "{{config.contextsDir}}/*/test/fakes/*.ts",
      "test/architecture/**/*.spec.ts"{{knip.e2eSpecs}}{{knip.testDatabase}}
    ]
  }
}
