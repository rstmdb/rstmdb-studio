# Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Build backend
FROM rust:1.85-alpine AS backend-builder

RUN apk add --no-cache musl-dev pkgconfig openssl-dev openssl-libs-static

WORKDIR /app

# Copy source
COPY Cargo.toml Cargo.lock ./
COPY src/ ./src/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Build the application
RUN cargo build --release

# Runtime image
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tini

WORKDIR /app

COPY --from=backend-builder /app/target/release/rstmdb-studio /usr/local/bin/

RUN mkdir -p /data && \
    adduser -D -u 1000 studio && \
    chown -R studio:studio /data

USER studio

ENV STUDIO_HOST=0.0.0.0
ENV STUDIO_PORT=8080
ENV RSTMDB_ADDR=rstmdb:7401

EXPOSE 8080

ENTRYPOINT ["/sbin/tini", "--", "rstmdb-studio"]
CMD ["serve"]
