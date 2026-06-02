FROM node:24-alpine AS installer

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g corepack@latest
RUN corepack enable

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile


FROM denoland/deno:alpine AS builder

WORKDIR /app

COPY --from=installer /app/node_modules ./node_modules
COPY . .

RUN deno compile \
    --allow-net --allow-env --allow-read --allow-sys \
    --output /app/server ./src/server.ts


FROM registry.access.redhat.com/hi/core-runtime:latest

WORKDIR /app

COPY --from=builder /app/server /app/server

ENV PORT=3000
EXPOSE 3000

CMD ["/app/server"]
