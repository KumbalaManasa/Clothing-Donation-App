FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js knexfile.js ./
COPY migrations ./migrations
COPY seeds ./seeds
COPY src ./src

EXPOSE 4000
CMD ["node", "index.js"]
