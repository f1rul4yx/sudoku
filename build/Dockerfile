FROM node:20-alpine

RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY package*.json ./
RUN npm install --production && npm cache clean --force

COPY src/ ./src/
COPY public/ ./public/

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=Europe/Madrid

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "src/server.js"]