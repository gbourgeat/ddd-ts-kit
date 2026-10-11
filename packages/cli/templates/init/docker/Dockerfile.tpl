# syntax=docker/dockerfile:1

FROM node:24-slim AS build
WORKDIR /app
{{#if pm.corepack}}
# corepack provides the release of the package manager that package.json pins.
RUN corepack enable
{{/if}}
COPY package.json package-lock.json{{#if pm.pnpm}} pnpm-workspace.yaml{{/if}} ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim AS dependencies
WORKDIR /app
{{#if pm.corepack}}
RUN corepack enable
{{/if}}
COPY package.json package-lock.json{{#if pm.pnpm}} pnpm-workspace.yaml{{/if}} ./
RUN npm ci --omit=dev

FROM node:24-slim
# The entry point: the whole application, or one context run alone (--build-arg ENTRY=dist/{{config.sourceRoot}}/apps/<context>/main.js).
ARG ENTRY=dist/{{config.sourceRoot}}/main.js
ENV NODE_ENV=production
ENV ENTRY=${ENTRY}
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
CMD ["sh", "-c", "exec node $ENTRY"]
