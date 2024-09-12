# syntax=docker/dockerfile:1
#----------------------------------------#
# dev/test
FROM node:18.17-alpine AS deps
RUN apk add --no-cache --virtual .gyp python3 make g++ libc6-compat && \
    npm i -g npm
ENV NPM_CONFIG_PREFER_OFFLINE=true
ENV PATH="node_modules/.bin:$PATH"

USER node
WORKDIR /home/node

# "Cache" node_modules first so that changes in the source code doesn't trigger a rebuild
COPY --chown=node:node [ "package*.json", ".npmrc", "./" ]
RUN npm ci

COPY --chown=node:node . .


#----------------------------------------#
# We have a separate build container to persist build artifacts & production npm deps
FROM node:18.17-alpine AS build
RUN apk add --no-cache --virtual .gyp python3 make g++ libc6-compat && \
    npm i -g npm
ENV NPM_CONFIG_PREFER_OFFLINE=true

USER node
WORKDIR /home/node

# idk if this *actually* caches node_modules from the deps image or not so that the first COPY is only run when package.json changes
COPY --chown=node:node --from=deps /home/node/node_modules ./node_modules
COPY --chown=node:node . ./

RUN npm run build && \
    npm prune --production && \
    rm -rf .cache .npm


#----------------------------------------#
FROM node:18.17-alpine AS runner
RUN apk add --no-cache tini

USER node
WORKDIR /home/node

COPY --from=build /home/node ./

ENV NODE_ENV production

# While we already handle SIGINT/SIGTERM directly, there is no way for us to be 100% SURE that none of our dependencies won't spawn a zombie process.
ENTRYPOINT ["tini", "--"]
CMD ["node", "bin/www"]

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
