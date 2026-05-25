FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

# Ferramentas úteis para debug (redis-cli via redis-tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    redis-tools \
    curl \
    && rm -rf /var/lib/apt/lists/*
