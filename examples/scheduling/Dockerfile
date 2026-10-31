# syntax=docker/dockerfile:1

FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:26-slim
# The entry point: the whole application, or one context run alone (--build-arg ENTRY=dist/src/apps/<context>/main.js).
ARG ENTRY=dist/src/main.js
ENV NODE_ENV=production
ENV ENTRY=${ENTRY}
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
CMD ["sh", "-c", "exec node $ENTRY"]
