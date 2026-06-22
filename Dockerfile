FROM node:20-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV PORT=8000

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc pnpm-approved-builds.json ./
COPY apps/proxy/package.json apps/proxy/package.json
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile --prod=false

COPY apps/proxy apps/proxy

RUN pnpm --filter @deepds/proxy build

ENV NODE_ENV=production

EXPOSE 8000

CMD ["pnpm", "--filter", "@deepds/proxy", "start"]
