{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": [
    "{{config.contextsDir}}/*/*.module.ts",
    "{{config.contextsDir}}/*/published-language/index.ts",
    "{{config.contextsDir}}/*/test/fakes/*.ts",
    "scripts/*.ts"{{knip.e2eEntry}}
  ],
  "project": ["{{config.sourceRoot}}/**/*.ts", "scripts/**/*.ts"{{knip.e2eProject}}],
{{#if ci.gitlab}}
  "ignoreDependencies": ["eslint-formatter-gitlab"],
{{/if}}
  "ignoreExportsUsedInFile": true,
  "vitest": {
    "config": ["vitest.config.ts"{{knip.e2eConfig}}],
    "entry": ["{{config.sourceRoot}}/**/*.spec.ts"{{knip.e2eSpecs}}]
  }
}
