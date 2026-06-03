FROM denoland/deno:alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY deno.json deno.lock ./

# Install dependencies
RUN deno i

COPY . .

RUN deno compile \
    --allow-net --allow-env --allow-read --allow-sys \
    --output /app/server ./src/server.ts


# Tiny runtime image with just the compiled binary
FROM registry.access.redhat.com/hi/core-runtime:latest

WORKDIR /app

COPY --from=builder /app/server /app/server

ENV PORT=3000
EXPOSE 3000

CMD ["/app/server"]
