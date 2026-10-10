
  # The scheduled jobs in a process of their own: the same image, another entry point. The API then starts with its jobs off (RUN_JOBS).
  worker:
    build:
      context: .
      args:
        ENTRY: dist/{{config.sourceRoot}}/apps/worker/main.js
    profiles: [services]
    env_file: .env
    environment:
      RUN_JOBS: "true"
