# syntax=docker/dockerfile:1.7
#
# eropub.com – Container-Image für Web (Next.js) und Worker.
#
#   docker build --target web    -t eropub-web:<tag> .
#   docker build --target worker -t eropub-worker:<tag> .
#
# Hinweise:
# - Ein Image-Stack für beide Prozesse: Der Worker läuft mit `tsx` (devDependency),
#   `prisma migrate deploy` braucht die Prisma-CLI (devDependency). Deshalb bleiben die
#   devDependencies im Laufzeit-Image. Kein `output: "standalone"` vorausgesetzt.
# - Node-Version ist per Tag gepinnt. Beim Update Tag bewusst anheben und neu testen.
# - Zur Build-Zeit werden KEINE Secrets benötigt oder eingebacken. Alle Werte kommen zur
#   Laufzeit aus .env.production (siehe docker-compose.prod.yml).

ARG NODE_IMAGE=node:22.23.4-bookworm-slim

# ─────────────────────────────── Basis ───────────────────────────────
FROM ${NODE_IMAGE} AS base
# openssl: von Prisma-Engines benötigt; ca-certificates: TLS zu SMTP/Anbietern; tini: PID 1 / Signale
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# ─────────────────────────── Abhängigkeiten ───────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
# prisma/ wird vor `npm ci` benötigt, da `postinstall` `prisma generate` ausführt.
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit

# ──────────────────────────────── Build ───────────────────────────────
FROM deps AS build
COPY . .
RUN npx prisma generate \
 && NODE_ENV=production npm run build \
 && rm -rf .next/cache

# ─────────────────────────── Laufzeit (gemeinsam) ─────────────────────
FROM base AS runtime
ENV NODE_ENV=production
# Offizielles Node-Image bringt den unprivilegierten Benutzer `node` (UID/GID 1000) mit.
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/worker ./worker
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/next.config.* /app/tsconfig.json ./
USER node
ENTRYPOINT ["/usr/bin/tini", "--"]

# ──────────────────────────────── Web ─────────────────────────────────
FROM runtime AS web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["npm", "run", "start"]

# ─────────────────────────────── Worker ───────────────────────────────
FROM runtime AS worker
CMD ["npm", "run", "worker"]
