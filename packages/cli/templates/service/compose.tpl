
  # The context "{{context.kebab}}" as its own service: the same image, another entry point.
  {{context.kebab}}:
    build:
      context: .
      args:
        ENTRY: dist/{{config.sourceRoot}}/apps/{{context.kebab}}/main.js
    profiles: [services]
    env_file: .env
    ports:
      - "${{service.portVariable}}:3000"
