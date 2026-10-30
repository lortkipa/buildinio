# The server's runtime for `docker compose up` (see the README): Node, plus the Docker
# CLI, so the AI's commands still run in their own throwaway containers next to this one.
FROM node:22-bookworm
COPY --from=docker:29-cli /usr/local/bin/docker /usr/local/bin/docker
