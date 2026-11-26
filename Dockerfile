FROM oven/bun:1.3
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
RUN bun run typecheck && bun test tests/sync-merge.test.ts tests/sync-database.test.ts && bun run build
ENV NODE_ENV=production
CMD ["bun","run","start"]
