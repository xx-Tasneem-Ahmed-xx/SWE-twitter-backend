FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

RUN npm run build
FROM node:20-alpine AS production
WORKDIR /app

RUN npm install -g pm2

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package*.json ./

COPY ecosystem.config.cjs ./ecosystem.config.cjs

EXPOSE 8080

CMD ["pm2-runtime", "ecosystem.config.cjs"]

