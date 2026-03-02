# ---------- Stage 1 & 2: Build js-core and frontend ----------
FROM node:23-alpine AS build

ARG VITE_API_URL

WORKDIR /work

# 1️⃣ Copy both project dirs for caching
COPY src/sdk/js-core/package.json src/sdk/js-core/yarn.lock ./src/sdk/js-core/
COPY examples/hello-world-app/packages/frontend/package.json ./examples/hello-world-app/packages/frontend/

# Yarn workspaces monorepo: single lockfile at repo root.
# Copy root package.json + yarn.lock so installs in /packages/frontend use the root lock.
COPY examples/hello-world-app/yarn.lock ./examples/hello-world-app/
COPY examples/hello-world-app/package.json ./examples/hello-world-app/

# 2️⃣ Install js-core deps (cacheable)
WORKDIR /work/src/sdk/js-core
RUN yarn install --frozen-lockfile --ignore-scripts

# 3️⃣ Copy full source
WORKDIR /work
COPY src/sdk/js-core ./src/sdk/js-core
COPY examples/hello-world-app/packages/frontend ./examples/hello-world-app/packages/frontend

# 4️⃣ Build js-core
WORKDIR /work/src/sdk/js-core
RUN yarn build

# 5️⃣ Build frontend with local dist dependency
WORKDIR /work/examples/hello-world-app/packages/frontend
RUN yarn install --frozen-lockfile && yarn build

# ---------- Stage 3: Runtime ----------
FROM nginx:alpine AS final
COPY --from=build /work/examples/hello-world-app/packages/frontend/dist /usr/share/nginx/html
COPY examples/hello-world-app/packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
